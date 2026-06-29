// Ruční import workitemů z JSON souboru (stejný kontrakt jako POST /api/workitems).
// Replikuje logiku src/lib/ingest.ts pomocí raw SQL (schéma "schvaleem").
//
// Spuštění:
//   node scripts/import-workitems.cjs <soubor.json> [--purge]
//     <soubor.json>  pole [ {...}, ... ] nebo jeden objekt {...}
//     --purge        před importem smaže provozní data (Document, Workitem, Workflow)
//                    KONFIGURACE A UŽIVATELÉ ZŮSTÁVAJÍ.
require("dotenv/config");
const { Client } = require("pg");
const { randomBytes } = require("crypto");
const fs = require("fs");

function rid(prefix) {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

// --- replikace src/lib/erp.ts ---------------------------------------------
function parseErpDate(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const cz = s.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (cz) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = cz;
    const ms = Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss);
    return isNaN(ms) ? null : new Date(ms);
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}
function normalizeDataArea(code) {
  return String(code).trim().toUpperCase();
}

(async () => {
  const file = process.argv[2];
  const purge = process.argv.includes("--purge");
  if (!file) {
    console.error("Použití: node scripts/import-workitems.cjs <soubor.json> [--purge]");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = Array.isArray(raw) ? raw : [raw];

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("SET search_path TO schvaleem");

  if (purge) {
    await client.query("BEGIN");
    const d = await client.query('DELETE FROM "Document"');
    const wi = await client.query('DELETE FROM "Workitem"');
    const wf = await client.query('DELETE FROM "Workflow"');
    await client.query("COMMIT");
    console.log(`Vyčištěno: Document=${d.rowCount}, Workitem=${wi.rowCount}, Workflow=${wf.rowCount}`);
  }

  let created = 0,
    updated = 0;

  for (const v of items) {
    const dataAreaCode = normalizeDataArea(v.dataArea);

    // DataArea – vytvořit, pokud neznáme; získat organizationId.
    await client.query(
      'INSERT INTO "DataArea" (id, code) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',
      [rid("da"), dataAreaCode],
    );
    const da = await client.query(
      'SELECT id, "organizationId" FROM "DataArea" WHERE code=$1',
      [dataAreaCode],
    );
    const organizationId = da.rows[0]?.organizationId ?? null;

    // Workflow upsert (erpWorkflowId + dataAreaCode).
    const wf = await client.query(
      `INSERT INTO "Workflow"
         (id, "erpWorkflowId", "dataAreaCode", "documentType", "recordId", values,
          "organizationId", "documentTypeName", label, originator, "trackingStatus", "erpCreatedAt")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
       ON CONFLICT ("erpWorkflowId","dataAreaCode") DO UPDATE SET
         "documentType"=EXCLUDED."documentType",
         "recordId"=EXCLUDED."recordId",
         values=EXCLUDED.values,
         "organizationId"=EXCLUDED."organizationId",
         "documentTypeName"=EXCLUDED."documentTypeName",
         label=EXCLUDED.label,
         originator=EXCLUDED.originator,
         "trackingStatus"=EXCLUDED."trackingStatus",
         "erpCreatedAt"=EXCLUDED."erpCreatedAt"
       RETURNING id`,
      [
        rid("wf"),
        v.workflowId,
        dataAreaCode,
        v.documentType,
        v.recordId ?? null,
        JSON.stringify(v.values ?? {}),
        organizationId,
        v.documentTypeName ?? null,
        v.documentLabel ?? null,
        v.originator ?? null,
        v.trackingStatus ?? null,
        parseErpDate(v.createdDateTime),
      ],
    );
    const workflowId = wf.rows[0].id;

    // Workitem upsert (erpWorkitemId).
    const wi = await client.query(
      `INSERT INTO "Workitem"
         (id, "erpWorkitemId", "workflowId", "dataAreaCode", "assigneeErpUserId",
          subject, description, "dueAt", "erpStatus")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("erpWorkitemId") DO UPDATE SET
         "workflowId"=EXCLUDED."workflowId",
         "dataAreaCode"=EXCLUDED."dataAreaCode",
         "assigneeErpUserId"=EXCLUDED."assigneeErpUserId",
         subject=EXCLUDED.subject,
         description=EXCLUDED.description,
         "dueAt"=EXCLUDED."dueAt",
         "erpStatus"=EXCLUDED."erpStatus"
       RETURNING (xmax = 0) AS inserted`,
      [
        rid("wi"),
        v.workitemId,
        workflowId,
        dataAreaCode,
        v.assigneeUserId,
        v.subject ?? null,
        v.description ?? null,
        parseErpDate(v.dueDateTime),
        v.workitemStatus ?? null,
      ],
    );
    if (wi.rows[0].inserted) created++;
    else updated++;
  }

  await client.end();
  console.log(`Import hotov: nových=${created}, aktualizovaných=${updated}, celkem=${items.length}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
