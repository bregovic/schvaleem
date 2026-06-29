# schvaleem

Schvalovací systém / **workflow-approval hub**. ERP systém (zatím Microsoft Dynamics
**AX 2012**, obecně i jiné) posílá přes REST API aktivní **workitemy** workflow. Lidé je
odbavují ve webovém rozhraní (schválit / zamítnout, swipe i hromadně), ERP si výsledek
**vyzvedne přes GET** a po převzetí se provozní data z aplikace **mažou** (jsou jen
provozní).

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Prisma 7** (driver adapter `@prisma/adapter-pg`) + **PostgreSQL** (Railway)
- Vlastní DB session přihlášení (email + heslo, bcrypt)
- Tailwind CSS 4
- Nasazení na **Railway**

## Datový model (stručně)

**Konfigurace (trvalá):**
- `Organization` → `DataArea` (kód = `dataAreaId` z ERP; přiřazení přes wizard ve Správě)
- `DocumentTypeConfig` (organizace + typ dokumentu): `FieldConfig` (mapování pole z JSON →
  popisek + role TITLE/AMOUNT/CURRENCY/DETAIL/HIDDEN), `ActionConfig` (metody) a pravidla
  (povinný komentář, limit částky).

**Provoz (přechodné, maže se po převzetí z ERP):**
- `Workflow` = obsah dokumentu (`erpWorkflowId`, `dataAreaCode`, `documentType`, `recordId`,
  `values` JSON) + volitelná PDF.
- `Workitem` = úkol pro jednoho schvalovatele (`erpWorkitemId`, `assigneeErpUserId`, stav,
  akce, komentář, kdo/kdy).
- `User` má `erpUserId` a vidí **jen své** workitemy.

Tabulky žijí ve schématu **`schvaleem`** (sdílená Railway PostgreSQL instance s dalšími
projekty – schémata `dms`/`public` se nikdy nedotýkáme).

## Lokální vývoj

```bash
npm install
cp .env.example .env     # doplň DATABASE_URL (?schema=schvaleem) a SESSION_SECRET
npm run db:deploy        # nasadí migrace do schématu schvaleem
npm run db:seed          # vytvoří admina a první API klíč (vypíše heslo + klíč)
npm run dev
```

- `SEED_EMAIL` / `SEED_PASSWORD` / `SEED_NAME` přepíšou výchozí seed.
- Přihlaš se, ve **Správě** založ organizace, přiřaď dataAreas a nakonfiguruj typy dokumentů.
- Schvalovatel musí mít vyplněné **ERP userId** (Správa → Uživatelé), aby mu chodily workitemy.

## API pro ERP

Plná specifikace: [`docs/API.md`](docs/API.md). Autentizace statickým API klíčem
(`Authorization: Bearer <klíč>` nebo `X-API-Key: <klíč>`). Shrnutí:

| Endpoint | Metoda | Účel | Úspěch |
| --- | --- | --- | --- |
| `/api/auth/token` | POST | (volitelné) získání tokenu | 200 |
| `/api/workitems` | POST | příjem jednoho aktivního workitemu | 201 |
| `/api/workitems` | GET | ERP si vyzvedne rozhodnutí (`?status=decided`) | 200 |
| `/api/workitems/{erpWorkitemId}` | PATCH | potvrzení převzetí / dokončení → smazat | 204 |
| `/api/workflows/complete` | POST | workflow dokončeno v ERP bez uživatele | 204 |
| `/api/documents` | POST | PDF (Base64) navázané na workflow | 201 |
| `/api/documents/{id}` | GET | stažení PDF (Base64) | 200 |
| `/api/health` | GET | test dostupnosti / TLS | 200 |

GET vrací povinně obálku `{ "records": [...] }` a chyby formát `{ "error", "message" }`
(kvůli parsování v AX). PATCH vrací **204** (AX podle toho pozná úspěch).

## Nasazení (Railway)

Projekt `splendid-commitment`, environment **Schvaleem**, služba **schvaleem**.
DB je sdílený Postgres (`Postgres-CjaQ`, environment ValiBook) – proto se používá
**veřejná proxy URL** s `?schema=schvaleem`. Start: `npm run db:deploy && npm run start`
(viz `railway.json`).
