// Seed konfigurace EPH: organizace + společnosti (ContextCompanyId = dataArea)
// + 3 typy dokumentů (ContextTableId = documentType).
// Spuštění: node scripts/seed-eph.cjs   (čte DATABASE_URL z .env)
require("dotenv/config");
const { Client } = require("pg");
const { randomBytes } = require("crypto");
const rid = (p) => p + "_" + randomBytes(10).toString("base64url");

// ContextTableId -> název dokumentu
const DOC_TYPES = [
  ["4007", "Cestovní žádanka"],
  ["1425", "Schvalování přijatých faktur dodavatele"],
  ["16448", "Zálohová faktura"],
];

// ContextCompanyId -> název společnosti
const COMPANIES = [
  ["18", "1890s holdings a.s."],
  ["ACQ", "Wanheim Immo s.r.o."],
  ["AE", "ANDELTA, a.s."],
  ["ap", "ap"],
  ["AV", "EP Intermodal a.s."],
  ["BA", "BAULIGA a.s."],
  ["BI", "EP BidCo a.s."],
  ["BL", "Blacktish s.r.o."],
  ["BO", "Boldore a.s."],
  ["BP", "CZECH MEDIA INVEST a.s."],
  ["BT", "EP Global Commerce a.s."],
  ["BTE", "EP Global Commerce a.s."],
  ["CA", "LEAG Holding, a.s."],
  ["CC", "Czech Radio Center a.s."],
  ["CE", "EPHCEI HoldCo a.s."],
  ["CEJ", "FVE Čejkovice s.r.o."],
  ["CN", "EP Infrastructure, a.s."],
  ["CNE", "EP Infrastructure, a.s."],
  ["CO", "Colora, a.s."],
  ["CO1", "DK holdings a.s."],
  ["CO2", "HoldCo II, a.s."],
  ["CS", "CZECH RADIO SERVICES a.s. v likvidaci"],
  ["CV", "CN Invest a.s."],
  ["DAT", "Company accounts data"],
  ["E1", "DCR INVESTMENT a.s."],
  ["EA", "EP Auto, s.r.o."],
  ["EC", "EPH Financing CZ, a.s."],
  ["EF", "EP Energy, a.s."],
  ["EH", "ED Holding a.s."],
  ["EI", "EP Industries, a.s."],
  ["EII", "Paris Real Estate II a.s."],
  ["EL", "EP Logistics International, a.s."],
  ["EO", "EPI Holding, a.s."],
  ["EP", "EPIF Investments a.s."],
  ["EP1", "EP nemovitosti I s.r.o."],
  ["EP2", "EP nemovitosti II s.r.o."],
  ["EP3", "EP nemovitosti III s.r.o."],
  ["EP4", "EP nemovitosti IV s.r.o."],
  ["EP5", "EP nemovitosti V s.r.o."],
  ["EP6", "EP nemovitosti VI s.r.o."],
  ["EPE", "EPIF Investments a.s."],
  ["EPF", "EP Fleet, s.r.o."],
  ["ER", "Energetický a průmyslový holding, a.s."],
  ["ERE", "Energetický a průmyslový holding, a.s."],
  ["ESI", "Paris Real Estate I a.s."],
  ["ESP", "Enterprise Esports, s.r.o."],
  ["EUP", "EUP a.s."],
  ["EV", "EP United Kingdom, s.r.o."],
  ["FH", "FoundHold EP Corporate Group, a.s."],
  ["FIE", "EPH Financing International, a.s."],
  ["FIN", "EPH Financing International, a.s."],
  ["FR", "EP FR HoldCo a.s."],
  ["FVE", "FVE Holding, s.r.o."],
  ["GAR", "Garage Hol Project s.r.o."],
  ["GE", "EP Risk Management Services, a.s."],
  ["GI", "Groš reality I s.r.o."],
  ["GII", "Groš reality II s.r.o."],
  ["GN", "Greeninvest Energy, a.s."],
  ["GR", "EP Corporate Group, a.s."],
  ["GRE", "EP Group, a.s."],
  ["HA", "EP Hagibor a.s."],
  ["HC1", "HoldCo I a.s."],
  ["HO", "EP HoldCo a.s."],
  ["HO1", "Vitality Invest, a.s."],
  ["HP", "EP Heat & Power a.s."],
  ["HPE", "ResInvest Sunrise a.s."],
  ["HU", "NEPOUŽÍVAT - EP Hungary, a.s."],
  ["HUN", "EP Hungary s.r.o."],
  ["HX", "HX Medical a.s."],
  ["IA", "EP Investment Advisors, s.r.o."],
  ["IM", "INTERNATIONAL MEDIA INVEST a.s."],
  ["IN", "EP Cargo Invest a.s."],
  ["JP", "JATS PLUS a.s."],
  ["KID", "EP Kids, z.s."],
  ["KP", "Kardašovská Properties a.s."],
  ["KV", "Kapsova Vila a.s."],
  ["LAB", "DIVR LABS s.r.o."],
  ["LI", "Lirostana s.r.o."],
  ["LOK", "Loko Reality s.r.o."],
  ["LP", "Letná Properties, a.s."],
  ["LP2", "Letná Properties II, a.s."],
  ["MD", "Elektrárny Opatovice, a.s."],
  ["ME", "MENH a.s."],
  ["MH", "EP Energy Transition, a.s."],
  ["MHE", "EP Energy Transition, a.s."],
  ["MI", "Michelský trojúhelník v.o.s."],
  ["MR", "Malešice Reality s.r.o."],
  ["MT", "MR TRUST s.r.o."],
  ["MX", "CE Electronics Holding, a.s."],
  ["N2", "NADURENE 2, a.s."],
  ["NA", "NADURENE a.s."],
  ["NAD", "Nadace EP Group"],
  ["NAP", "FVE Napajedla s.r.o."],
  ["NEM", "FVE Němčice s.r.o."],
  ["NI", "Nová Invalidovna, a.s."],
  ["NM", "Nové Modřany, a.s."],
  ["NO", "EPIF BidCo I s.r.o."],
  ["NV", "Nový Veleslavín, a.s."],
  ["OG", "Ogen s.r.o."],
  ["OP", "Industrial Park Opatovice s.r.o."],
  ["OQ", "Old Queen Street, a.s."],
  ["OQL", "Old Queen Street, a.s."],
  ["P1", "PI 1 a.s."],
  ["P2", "PT Properties II, a.s."],
  ["P3", "PT Properties III, a.s."],
  ["P4", "PT Properties IV, a.s."],
  ["PA", "Patamon a.s."],
  ["PC", "EPPE Germany, a.s."],
  ["PCE", "EPPE Germany, a.s."],
  ["PDH", "Parcel Delivery Holding s.r.o."],
  ["PE", "EP Power Europe, a.s."],
  ["PEE", "EP Power Europe, a.s."],
  ["PER", "PERIGO a.s."],
  ["PF", "EP Distribution Services a.s."],
  ["PI", "Poisson Investments a.s."],
  ["PJ", "Pod Juliskou, a.s."],
  ["PO", "Power Reality s.r.o."],
  ["PP", "Paťanka Properties, a.s."],
  ["PR", "EP Properties, a.s."],
  ["PT", "PT Properties I, a.s."],
  ["PW", "POWERSUN a.s."],
  ["RAE", "ResInvest Assets a.s."],
  ["RE", "EP Real Estate, a.s."],
  ["REC", "FVE Recycle, s.r.o."],
  ["RGE", "ResInvest Group a.s."],
  ["RHE", "ResInvest Holding a.s."],
  ["RHO", "ResInvest Horizon a.s."],
  ["RI", "Resource Industry Investment a.s."],
  ["RIA", "ResInvest Advisory s.r.o."],
  ["RIG", "ResInvest Assets a.s."],
  ["RIH", "ResInvest Holding a.s."],
  ["RIK", "ResInvest Kraft a.s."],
  ["RIN", "ResInvest Group a.s."],
  ["RP", "RPC s.r.o."],
  ["RZ", "EC Investments a.s."],
  ["SA", "CZECH PRINT CENTER - Development s.r.o."],
  ["SE", "SELIMETO SE"],
  ["SG", "SPEDICA GROUP COMPANIES, s.r.o."],
  ["SH", "Energetické montáže Holding, a.s."],
  ["SL", "FAST ČR, a.s."],
  ["SLU", "FVE Slušovice s.r.o."],
  ["SO", "SOLICHONER a.s."],
  ["SP", "EP Sport Holdings, a.s."],
  ["SR", "SPRITER, a.s."],
  ["ST", "Střelničná reality s.r.o."],
  ["TY", "EPRE Reality s.r.o."],
  ["UNC", "health uncompromised a.s."],
  ["VC", "VTE Pchery, s.r.o."],
  ["VD", "VS development s.r.o."],
  ["VN", "RPC s.r.o."],
  ["ZE", "EDH Invest a.s."],
  ["ZR", "Zálesí Reality s.r.o."],
  ["ZT", "Zeterano a.s."],
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("SET search_path TO schvaleem");

  // Organizace EPH
  await c.query(
    `INSERT INTO "Organization"(id,name) VALUES($1,'EPH') ON CONFLICT(name) DO NOTHING`,
    [rid("org")],
  );
  const org = (await c.query(`SELECT id FROM "Organization" WHERE name='EPH'`)).rows[0].id;

  // Společnosti -> dataAreas pod EPH
  for (const [code, name] of COMPANIES) {
    await c.query(
      `INSERT INTO "DataArea"(id,code,name,"organizationId") VALUES($1,$2,$3,$4)
       ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,"organizationId"=EXCLUDED."organizationId"`,
      [rid("da"), code.toUpperCase(), name, org],
    );
  }

  // Typy dokumentů (ContextTableId) pod EPH
  for (const [docType, name] of DOC_TYPES) {
    await c.query(
      `INSERT INTO "DocumentTypeConfig"(id,"organizationId","documentType",name,"requireCommentOnReject","updatedAt")
       VALUES($1,$2,$3,$4,true,now())
       ON CONFLICT("organizationId","documentType") DO UPDATE SET name=EXCLUDED.name`,
      [rid("cfg"), org, docType, name],
    );
  }

  const counts = await c.query(
    `SELECT (SELECT count(*) FROM "DataArea" WHERE "organizationId"=$1) da,
            (SELECT count(*) FROM "DocumentTypeConfig" WHERE "organizationId"=$1) cfg`,
    [org],
  );
  console.log("EPH hotovo – dataAreas:", counts.rows[0].da, "konfigurace:", counts.rows[0].cfg);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
