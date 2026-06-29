// Přidá registrové kontroly (ARES, DPH) ke konfiguracím faktury (1425) a
// zálohové faktury (16448). Idempotentní: přidá jen chybějící (dle type+jsonKey).
//   node scripts/seed-registry-checks.cjs
require("dotenv/config");
const { Client } = require("pg");
const { randomBytes } = require("crypto");
const rid = (p) => `${p}_${randomBytes(12).toString("base64url")}`;

// [type, jsonKey, label]
const CHECKS = [
  ["ARES_SUBJECT", "IČO", "ARES – aktivní subjekt"],
  ["VAT_RELIABILITY", "DIČ", "Spolehlivost plátce DPH"],
  ["VAT_ACCOUNT_PUBLISHED", "Bankovní účet", "Zveřejněný účet pro DPH"],
];
const DOC_TYPES = ["1425", "16448"];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SET search_path TO schvaleem");

  for (const docType of DOC_TYPES) {
    const cfg = await c.query('SELECT id FROM "DocumentTypeConfig" WHERE "documentType"=$1', [docType]);
    if (!cfg.rows.length) {
      console.log(`! ${docType}: konfigurace neexistuje – přeskočeno.`);
      continue;
    }
    const configId = cfg.rows[0].id;
    const ord = await c.query('SELECT COALESCE(MAX("order"),-1)::int AS m FROM "CheckConfig" WHERE "configId"=$1', [configId]);
    let order = ord.rows[0].m + 1;
    let added = 0;
    for (const [type, jsonKey, label] of CHECKS) {
      const ex = await c.query(
        'SELECT 1 FROM "CheckConfig" WHERE "configId"=$1 AND type=$2::"CheckType" AND "jsonKey"=$3',
        [configId, type, jsonKey],
      );
      if (ex.rows.length) continue;
      await c.query(
        'INSERT INTO "CheckConfig" (id, "configId", type, "jsonKey", label, "order") VALUES ($1,$2,$3::"CheckType",$4,$5,$6)',
        [rid("chk"), configId, type, jsonKey, label, order++],
      );
      added++;
    }
    console.log(`${docType}: přidáno ${added} registrových kontrol.`);
  }

  await c.end();
  console.log("Hotovo.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
