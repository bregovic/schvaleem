// Seed: vytvoří prvního administrátora a jeden API klíč pro AX.
// Spuštění: node scripts/seed.cjs   (čte DATABASE_URL z .env)
//   volitelně: SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed.cjs
require("dotenv/config");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const { randomBytes, createHash } = require("crypto");

function rid(prefix) {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}
function sha256(v) {
  return createHash("sha256").update(v).digest("hex");
}

(async () => {
  const email = (process.env.SEED_EMAIL || "vac.kral@gmail.com").toLowerCase();
  const password = process.env.SEED_PASSWORD || randomBytes(6).toString("base64url");
  const name = process.env.SEED_NAME || "Admin";

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("SET search_path TO schvaleem");

  // Admin uživatel (idempotentně podle emailu).
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await client.query('SELECT id FROM "User" WHERE email=$1', [email]);
  if (existing.rows.length) {
    await client.query(
      'UPDATE "User" SET "passwordHash"=$1, role=\'ADMIN\', active=true WHERE email=$2',
      [passwordHash, email],
    );
    console.log(`Admin už existoval – heslo resetováno: ${email} / ${password}`);
  } else {
    await client.query(
      'INSERT INTO "User" (id, email, name, "passwordHash", role, active) VALUES ($1,$2,$3,$4,\'ADMIN\',true)',
      [rid("usr"), email, name, passwordHash],
    );
    console.log(`Admin vytvořen: ${email} / ${password}`);
  }

  // Jeden API klíč pro AX (jen pokud žádný aktivní není).
  const keys = await client.query("SELECT id FROM \"ApiKey\" WHERE active=true");
  if (keys.rows.length === 0) {
    const key = `sk_${randomBytes(24).toString("base64url")}`;
    await client.query(
      'INSERT INTO "ApiKey" (id, name, prefix, "keyHash", active) VALUES ($1,$2,$3,$4,true)',
      [rid("key"), "AX 2012", key.slice(0, 11), sha256(key)],
    );
    console.log(`API klíč pro AX (ulož si ho, znovu se nezobrazí): ${key}`);
  } else {
    console.log("API klíč už existuje – přeskočeno.");
  }

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
