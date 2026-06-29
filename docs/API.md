# schvaleem – REST API pro ERP / AX 2012

Verze 2.0 (model workflow / workitem). Navazuje na původní technické zadání
`Zadani_API_Railway_AX2012.docx` a přizpůsobuje ho schvalovacímu workflow.

## Princip

1. ERP pošle každý **aktivní workitem** workflow do `/api/workitems` (obsah dokumentu +
   komu je přiřazen).
2. Schvalovatel (podle `assigneeUserId` = `erpUserId` účtu) ho v aplikaci schválí/zamítne.
3. ERP si periodicky vyzvedne rozhodnutí přes `GET /api/workitems?status=decided`.
4. ERP každé převzaté rozhodnutí potvrdí `PATCH /api/workitems/{erpWorkitemId}` →
   aplikace workitem **smaže** (a workflow, když už nemá žádné workitemy).
5. Pokud se workflow dokončí v ERP jinak (bez uživatele), ERP zavolá
   `POST /api/workflows/complete` a aplikace ho odstraní.

## Autentizace

Každé volání nese statický API klíč (vytvoříš ve Správě → API klíče):

```
Authorization: Bearer sk_xxx
```

nebo

```
X-API-Key: sk_xxx
```

Bez platného klíče → `401` s tělem `{ "error": "unauthorized", "message": "…" }`.
Veškerá komunikace přes HTTPS (Railway poskytuje TLS automaticky). Pozn.: AOS server AX 2012
může mít vypnuté TLS 1.2 – nejčastější příčina chyby handshake; ověř přes `GET /api/health`.

## Chyby a stavové kódy

Chybové odpovědi mají vždy tvar:

```json
{ "error": "stručný_kód", "message": "Lidsky čitelný popis." }
```

| Kód | Význam |
| --- | --- |
| 200 | OK (GET, token) |
| 201 | Vytvořeno (nový workitem / dokument) |
| 204 | Úspěšný PATCH / completion (bez těla) – AX podle 204 pozná úspěch |
| 400 | Špatný JSON / chybějící pole |
| 401 | Chybí nebo neplatný API klíč |
| 404 | Workitem / workflow / dokument nenalezen |
| 413 | Tělo příliš velké (PDF > 10 MB) |
| 500 | Chyba serveru |

---

## `POST /api/workitems` – příjem workitemu

Jeden workitem na volání. Obsah workflow se dedupuje podle `workflowId` + `dataArea`.

**Tělo (application/json):**

```json
{
  "workflowId": "WF-1001",
  "workitemId": "WI-5001",
  "dataArea": "CZ01",
  "documentType": "VendInvoice",
  "recordId": "INV-777",
  "assigneeUserId": "jnovak",
  "values": { "Vendor": "ACME s.r.o.", "Amount": "15000", "Currency": "CZK" }
}
```

- `workflowId` – id workflow instance z ERP
- `workitemId` – id workitemu z ERP (jedinečné; opakované odeslání je idempotentní)
- `dataArea` – `dataAreaId` z ERP (firma)
- `documentType` – typ dokladu; podle něj se hledá konfigurace zobrazení/pravidel
- `recordId` – recId zdrojového dokladu (volitelné)
- `assigneeUserId` – `userId` z ERP, kdo má schválit
- `values` – hodnoty dokumentu (libovolný JSON objekt)

**Odpověď 201:** `{ "workflowId": "...", "workitemId": "...", "status": "stored" }`
**Idempotentní 200:** stejné, navíc `"duplicate": true`.

## `GET /api/workitems` – vyzvednutí rozhodnutí

Parametry: `status=decided` (výchozí) | `pending`, volitelně `dataArea=CZ01`.
Vrací **obálku `records`** (kompatibilní s parsováním v AX):

```json
{
  "records": [
    {
      "workitemId": "WI-5001",
      "workflowId": "WF-1001",
      "dataArea": "CZ01",
      "documentType": "VendInvoice",
      "recordId": "INV-777",
      "assigneeUserId": "jnovak",
      "status": "APPROVED",
      "action": "APPROVE",
      "comment": "OK",
      "decidedByUserId": "jnovak",
      "decidedAt": "2026-06-29T08:45:48.369Z"
    }
  ]
}
```

`status` ∈ `APPROVED` | `REJECTED` | `COMPLETED_BY_SYSTEM`. Vrací jen ještě nepotvrzená
rozhodnutí (`deliveredToErpAt = null`).

## `PATCH /api/workitems/{erpWorkitemId}` – potvrzení převzetí

**Tělo:** `{ "acknowledged": true }` (nebo `{ "complete": true }` pro uzavření bez uživatele).
Aplikace workitem **smaže**; když workflow zůstane prázdné, smaže se i ono a jeho PDF.
**Odpověď: 204 No Content** (bez těla).

## `POST /api/workflows/complete` – dokončení bez uživatele

Workflow bylo dokončeno přímo v ERP. Smaže celé workflow včetně workitemů a dokumentů.

**Tělo:** `{ "workflowId": "WF-1001", "dataArea": "CZ01" }` → **204 No Content**.

---

## `POST /api/documents` – PDF k workflow

PDF se přenáší jako **Base64 v JSON** (žádný multipart – kvůli AX RetailCommonWebAPI).

```json
{
  "filename": "faktura_777.pdf",
  "workflowId": "WF-1001",
  "dataArea": "CZ01",
  "contentBase64": "JVBERi0xLjQK..."
}
```

Server ověří hlavičku `%PDF`, limit 10 MB (jinak `413`). **Odpověď 201:**
`{ "id": "doc_xxx", "filename": "...", "status": "stored" }`.

## `GET /api/documents/{id}` – stažení PDF

Vrací PDF zpět jako Base64:
`{ "id", "filename", "contentType", "size", "contentBase64" }`.

## `POST /api/auth/token` – volitelný token endpoint

Zachovává původní tok AX (POST přihlášení → z odpovědi `access_token`). Jako `client_secret`
se pošle platný API klíč; vrací se zpět jako `access_token`:

```
POST /api/auth/token
Content-Type: application/x-www-form-urlencoded

client_id=ax&client_secret=sk_xxx
```

**Odpověď 200:** `{ "access_token": "sk_xxx", "token_type": "Bearer", "expires_in": 3600 }`.
Doporučená alternativa: statický API klíč rovnou v hlavičce (bez tohoto endpointu).

## `GET /api/health`

`{ "status": "ok", "service": "schvaleem" }` – test dostupnosti a TLS z AOS.
