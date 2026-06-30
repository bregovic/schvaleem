# Schvaleem – kontext pro pokračování

Schvalovací aplikace + REST API pro AX2012. Next.js 16 + Prisma 7 (schéma
`schvaleem`, sdílí DB s DMS). Repo `bregovic/schvaleem`, deploy = push na `main`
→ Railway. Migrace ručně (`npx prisma migrate deploy`), build je sám nevolá.

## Kde to teď je (stav k poslednímu sezení)

Appka (frontend) je nasazená a funkční. Otevřené je hlavně **ověření v AX**:
- **Rekompilovat job `ax/Schvaleem_GenAllWorkitemsJson.xpp` → re-export → re-import.**
  Teprve pak se v appce projeví: částky napříč firmami, účetní měna,
  „Celkem k úhradě" **vč. DPH** a pole **DPH**.
- Ověřit na mobilu **náhled PDF** (pdf.js canvas, fullscreen, zoom +/−, scroll,
  Zpět/dvojklik zavře) a **odložené ve swipe** (nevrací se dokola).

## Hotové v posledním sezení

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
- Demo PDF jen v testu (`SCHVALEEM_DEMO_PDF=1`), NIKDY v produkci.
- TODO (z dřívějška): rotovat tajné klíče, které prolétly chatem (DB heslo, R2, PAT).
- Doc typy: 1425 přijatá faktura, 16448 zálohová, 4007 cestovní žádanka.
