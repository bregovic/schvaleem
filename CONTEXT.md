# Schvaleem – kontext pro pokračování

Schvalovací aplikace + REST API pro AX2012. Next.js 16 + Prisma 7 (schéma
`schvaleem`, sdílí DB s DMS). Repo `bregovic/schvaleem`, deploy = push na `main`
→ Railway. Migrace ručně (`npx prisma migrate deploy`), build je sám nevolá.

## Kde to teď je (stav k poslednímu sezení)

Appka nasazená a funkční. Otevřené = **ověření v AX** po re-kompilaci jobu:
- **Rekompilovat `ax/Schvaleem_GenAllWorkitemsJson.xpp` → re-export → re-import.**
  Pak se projeví: částky napříč firmami vč. DPH, účetní měna, **historie
  schvalování + reálná jména** (viz níže). Pozor na X++ chyby (viz gotchas).
- Ověřit na mobilu: swipe (viz níže) a **Web Push badge** (viz níže).

## Hotové v sezení 2026-07-02 (workflow historie, jména, UX, push)

- **Historie schvalování**: AX job nově čte `WorkflowTrackingTable` +
  `WorkflowTrackingCommentTable` přes `RootCorrelationId` (obě GLOBÁLNÍ, bez
  changeCompany) → embedded fn `trackingHistory()`; do JSON přidáno pole
  `history: [{type,user,userName,at,comment}]`. Filtr: jen odeslání + dokončovací
  akce (whitelist přes `enum2str`), „vytvoření workitemu" se vynechává, ale krok
  s komentářem se bere vždy; komentáře k události se spojují (`|`).
- **Reálná jména z `UserInfo`**: embedded fn `userName()` – POZOR: parametr musí
  být vázaný typ (`UserId uid = _userId;`), nevázaný `str` nesmí být ve WHERE.
  Do JSON přidáno `userName`, `assigneeName`, `originatorName` (ID zůstává kvůli
  vracení rozhodnutí do ERP; appka zobrazuje jméno).
- **App**: `Workflow.history` (Json), `Workflow.originatorName`, `Workitem.assigneeName`
  (migrace `20260702120000`, `_130000`). Ingest ukládá; validace přijímá volitelně.
- **Workflow info blok** (`workflow-info.ts` buildWorkflowInfo + `WorkflowInfo.tsx`
  full/compact): Odeslal + Řešitel + časová osa. Přesunut **pod Data dokumentu**
  na detailu, kompaktně v seznamu (Row) i na **swipe kartě** (max 3 kroky).
  `ApprovalItem.wf`.
- **Swipe gesto**: `dragMomentum=false` + `dragDirectionLock`, odložení jen dle
  vzdálenosti (práh 160), ne rychlosti; odložení = **přesun na konec fronty**
  (skip „teď ne", bez perzistence), fronta zahrnuje i dříve odložené.
- **Odznáček počtu čekajících** v navigaci (`PendingBadge`): SSR hodnota + polling
  ~45 s (getPendingCount akce) + `setAppBadge` na ikoně PWA.
- **Web Push** (badge i při ZAVŘENÉ appce): `PushSubscription` model
  (migrace `20260702140000`), `web-push` dep, `src/lib/push.ts`
  (VAPID, sendPushToUser, notifyAssignee – úklid 410/404). Ingest nového
  workitemu → `notifyAssignee`. SW (`public/sw.js`) push + notificationclick.
  **VAPID klíče v `.env` i na Railway** (env vars nastaveny přes railway CLI:
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
  `NEXT_PUBLIC_` se zapéká při buildu → po změně nutný rebuild.
- TODO/nápad: kdyby se první dotaz na povolení notifikací minul, přidat tlačítko
  „Zapnout upozornění"; pro badge při zavřené appce je nutná nainstalovaná PWA.

## Hotové dříve

- AX job (cross-company): čtení `WorkflowWorkItemTable` jednou globálně;
  doklad přes `changeCompany` s **čerstvými buffery** (buildDocValues) – jinak
  se plnila jen jedna firma na typ.
- Účetní měna z `Ledger.find(Ledger::primaryLedger(...)).AccountingCurrency`,
  částka v účetní měně přes `Currency::mstAmount` (kurz dokladu, fallback lístek).
- **Částka vč. DPH + DPH BEZ úprav AX mimo job**: hrubá částka se bere z textu
  workitemu (`parseDescAmount` – „Fakturovaná částka:" / „Celková částka:"),
  základ = součet řádků, DPH = hrubá − základ. (Pozn.: `calcTotals()` z jobu daň
  nedopočítá a `PurchTotals` z jobu/embedded funkce volat NELZE – „nedeklarováno".)
- Detail: hlavička jen firma z číselníku (název + kód), nahoře Popis faktury,
  „Celkem k úhradě" účetní formát tučně + DPH + ≈ účetní měna; pořadí sekcí
  Popis → Data dokumentu → Auto kontroly → Veřejné registry → Rozhodnutí.
- Náhled PDF: **pdf.js** render na canvas (`PdfView.tsx`) – Android v iframu PDF
  nezobrazí; fullscreen zoom/scroll, Zpět přes History API. Upload přílohy z detailu.
- Seznam: řádek pro mobil (dodavatel přes celou šířku, č. faktury+částka, popis,
  splatnost·vytvořeno na řádku). **Fulltext hledání** (dodavatel/IČO/č.faktury/VS/popis).
- Swipe: odložit nahoru i dolů; odložené do fronty swipe nepatří.
- **Priorita = jen po splatnosti** (overdue), ne limit/kontroly/blízký termín.
- Bezpečnost: opraven **IDOR** na `/dokument/[id]` (jen admin nebo řešitel workitemu).

## Pozn. / gotchas

- X++ embedded funkce v jobu: lze volat metody tabulek + kernel třídy
  (DateTimeUtil), ale NE aplikační třídy (PurchTotals) ani deklarovat jejich
  lokální proměnné.
- X++ WHERE: nevázaný `str` nelze; přiřaď do EDT (`UserId`, apod.).
- Workflow tracking tabulky (`WorkflowTrackingTable`, `WorkflowTrackingCommentTable`,
  `UserInfo`) jsou standardní/globální – žádný XPO import netřeba.
- Demo PDF jen v testu (`SCHVALEEM_DEMO_PDF=1`), NIKDY v produkci.
- TODO (z dřívějška): rotovat tajné klíče, které prolétly chatem (DB heslo, R2, PAT).
- Doc typy: 1425 přijatá faktura, 16448 zálohová, 4007 cestovní žádanka.
