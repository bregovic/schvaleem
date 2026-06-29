// Doplní pole + kontroly pro konfigurace zálohové faktury (16448) a cestovní
// žádanky (4007) tak, aby seděly na klíče z jobu Schvaleem_GenAllWorkitemsJson.
// Idempotentní: pole/kontroly přidá jen ke konfiguraci, která je ještě nemá.
//   node scripts/seed-doctype-configs.cjs
require("dotenv/config");
const { Client } = require("pg");
const { randomBytes } = require("crypto");

const rid = (p) => `${p}_${randomBytes(12).toString("base64url")}`;

// role: TITLE | AMOUNT | CURRENCY | DETAIL | HIDDEN ; [jsonKey, label, role, preview]
const FIELDS = {
  "16448": [
    ["Číslo zálohové faktury", "Číslo zálohové faktury", "TITLE", true],
    ["Dodavatel", "Dodavatel", "DETAIL", true],
    ["Celkem k úhradě", "Celkem k úhradě", "AMOUNT", true],
    ["Měna", "Měna", "CURRENCY", false],
    ["Datum splatnosti", "Datum splatnosti", "DETAIL", true],
    ["IČO", "IČO", "DETAIL", false],
    ["Bankovní účet", "Bankovní účet", "DETAIL", false],
    ["IBAN", "IBAN", "DETAIL", false],
    ["Číslo faktury dodavatele", "Číslo faktury dodavatele", "DETAIL", false],
    ["Datum faktury", "Datum faktury", "DETAIL", false],
    ["Popis", "Popis", "DETAIL", false],
  ],
  "4007": [
    ["Číslo žádanky", "Číslo žádanky", "TITLE", true],
    ["Žadatel", "Žadatel", "DETAIL", true],
    ["Odhad nákladů", "Odhad nákladů", "AMOUNT", true],
    ["Účel cesty", "Účel cesty", "DETAIL", true],
    ["Destinace", "Destinace", "DETAIL", false],
    ["Cesta od", "Cesta od", "DETAIL", false],
    ["Cesta do", "Cesta do", "DETAIL", false],
    ["Popis", "Popis", "DETAIL", false],
  ],
};

// type: BANK_ACCOUNT_CZ | ICO_CZ | IBAN | DIC_CZ ; [type, jsonKey, label]
const CHECKS = {
  "16448": [
    ["ICO_CZ", "IČO", "Kontrola IČO"],
    ["BANK_ACCOUNT_CZ", "Bankovní účet", "Modulo 11 čísla účtu"],
    ["IBAN", "IBAN", "Kontrola IBAN"],
  ],
  "4007": [],
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SET search_path TO schvaleem");

  for (const docType of Object.keys(FIELDS)) {
    const cfg = await c.query('SELECT id FROM "DocumentTypeConfig" WHERE "documentType"=$1', [docType]);
    if (!cfg.rows.length) {
      console.log(`! Konfigurace ${docType} neexistuje – přeskočeno.`);
      continue;
    }
    const configId = cfg.rows[0].id;

    const fc = await c.query('SELECT count(*)::int AS n FROM "FieldConfig" WHERE "configId"=$1', [configId]);
    if (fc.rows[0].n > 0) {
      console.log(`= ${docType}: pole už existují (${fc.rows[0].n}) – přeskočeno.`);
    } else {
      let order = 0;
      for (const [jsonKey, label, role, preview] of FIELDS[docType]) {
        await c.query(
          `INSERT INTO "FieldConfig" (id, "configId", "jsonKey", label, role, preview, "order")
           VALUES ($1,$2,$3,$4,$5::"FieldRole",$6,$7)`,
          [rid("fld"), configId, jsonKey, label, role, preview, order++],
        );
      }
      console.log(`+ ${docType}: přidáno ${FIELDS[docType].length} polí.`);
    }

    const ch = await c.query('SELECT count(*)::int AS n FROM "CheckConfig" WHERE "configId"=$1', [configId]);
    if (ch.rows[0].n > 0) {
      console.log(`= ${docType}: kontroly už existují (${ch.rows[0].n}) – přeskočeno.`);
    } else if (CHECKS[docType].length) {
      let order = 0;
      for (const [type, jsonKey, label] of CHECKS[docType]) {
        await c.query(
          `INSERT INTO "CheckConfig" (id, "configId", type, "jsonKey", label, "order")
           VALUES ($1,$2,$3::"CheckType",$4,$5,$6)`,
          [rid("chk"), configId, type, jsonKey, label, order++],
        );
      }
      console.log(`+ ${docType}: přidáno ${CHECKS[docType].length} kontrol.`);
    }
  }

  await c.end();
  console.log("Hotovo.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
