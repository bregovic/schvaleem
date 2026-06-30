import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type CheckType } from "@/generated/prisma/client";

export type RegistryResult = { ok: boolean | null; message: string };

type CacheKind = "ARES" | "VAT" | "FX";

const TTL_MS: Record<CacheKind, number> = {
  ARES: 7 * 24 * 3600_000, // 7 dní
  VAT: 24 * 3600_000, // 1 den (registr se aktualizuje denně)
  FX: 30 * 24 * 3600_000, // kurz daného dne je fixní → drž dlouho
};

// Cache přes RegistryCache (kind+key). Při chybě sítě vrátí starou cache, pokud je.
async function cached<T>(
  kind: CacheKind,
  key: string,
  fetcher: () => Promise<{ ok: boolean | null; data: T }>,
): Promise<{ ok: boolean | null; data: T } | null> {
  const hit = await prisma.registryCache.findUnique({ where: { kind_key: { kind, key } } });
  if (hit && Date.now() - hit.checkedAt.getTime() < TTL_MS[kind]) {
    return { ok: hit.ok, data: hit.result as T };
  }
  let res: { ok: boolean | null; data: T };
  try {
    res = await fetcher();
  } catch {
    return hit ? { ok: hit.ok, data: hit.result as T } : null;
  }
  await prisma.registryCache.upsert({
    where: { kind_key: { kind, key } },
    update: { ok: res.ok, result: res.data as Prisma.InputJsonValue, checkedAt: new Date() },
    create: { kind, key, ok: res.ok, result: res.data as Prisma.InputJsonValue },
  });
  return res;
}

// --- ARES: subjekt podle IČO ------------------------------------------------
type AresData = { exists: boolean; active: boolean; name: string | null; dic: string | null };

async function fetchAres(ico: string): Promise<{ ok: boolean | null; data: AresData }> {
  const r = await fetch(
    `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
    { headers: { accept: "application/json" } },
  );
  if (r.status === 404) {
    return { ok: false, data: { exists: false, active: false, name: null, dic: null } };
  }
  if (!r.ok) throw new Error(`ARES ${r.status}`);
  const j = (await r.json()) as {
    datumZaniku?: string;
    obchodniJmeno?: string;
    dic?: string;
  };
  const active = !j.datumZaniku;
  return {
    ok: active,
    data: { exists: true, active, name: j.obchodniJmeno ?? null, dic: j.dic ?? null },
  };
}

// --- DPH: nespolehlivý plátce + zveřejněné účty (SOAP, Finanční správa) ------
type VatAccount = { predcisli: string; cislo: string; kodBanky: string };
type VatData = { found: boolean; unreliable: boolean; accounts: VatAccount[] };

const VAT_ENDPOINT =
  "https://adisrws.mfcr.cz/adistc/axis2/services/rozhraniCRPDPH.rozhraniCRPDPHSOAP";

function attr(s: string, name: string): string {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
}

async function fetchVat(dic: string): Promise<{ ok: boolean | null; data: VatData }> {
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>` +
    `<StatusNespolehlivySubjektRozsirenyV2Request xmlns="http://adis.mfcr.cz/rozhraniCRPDPH/">` +
    `<dic>${dic}</dic>` +
    `</StatusNespolehlivySubjektRozsirenyV2Request></s:Body></s:Envelope>`;

  const r = await fetch(VAT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: "" },
    body,
  });
  if (!r.ok) throw new Error(`VAT ${r.status}`);
  const xml = await r.text();

  const stav = (xml.match(/nespolehlivyPlatce="([^"]*)"/) || [, "NENALEZEN"])[1];
  const found = stav === "ANO" || stav === "NE";
  const unreliable = stav === "ANO";

  const accounts: VatAccount[] = [];
  const re = /<[^>]*standardniUcet\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    accounts.push({
      predcisli: attr(m[1], "predcisli"),
      cislo: attr(m[1], "cislo"),
      kodBanky: attr(m[1], "kodBanky"),
    });
  }
  return { ok: found ? !unreliable : null, data: { found, unreliable, accounts } };
}

function normNum(s: string): string {
  return (s || "").replace(/\D/g, "").replace(/^0+/, "");
}

function accountPublished(invoiceAcc: string, accounts: VatAccount[]): boolean {
  const m = invoiceAcc.replace(/\s/g, "").match(/^(?:(\d+)-)?(\d+)\/(\d+)$/);
  if (!m) return false;
  const [, pref = "", base, bank] = m;
  return accounts.some(
    (ac) =>
      normNum(ac.cislo) === normNum(base) &&
      ac.kodBanky.replace(/\D/g, "") === bank.replace(/\D/g, "") &&
      normNum(ac.predcisli) === normNum(pref),
  );
}

// --- Přepočet na CZK kurzem ČNB k datu dokladu ------------------------------
// Denní kurzovní lístek ČNB (text, oddělený "|"): hlavička + řádky
// Country|Currency|Amount|Code|Rate. Rate je v CZK za "Amount" jednotek měny.
type FxRates = Record<string, { rate: number; amount: number }>;
export type FxConversion = { czk: number; perUnit: number; date: string };

// "DD.MM.YYYY" → stejný formát pro ČNB; cokoliv jiného → dnešní datum.
function cnbDateParam(dateStr: string): string {
  const m = (dateStr || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function fetchCnb(dateParam: string): Promise<{ ok: boolean | null; data: FxRates }> {
  const r = await fetch(
    "https://www.cnb.cz/en/financial-markets/foreign-exchange-market/" +
      "central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt" +
      `?date=${dateParam}`,
  );
  if (!r.ok) throw new Error(`CNB ${r.status}`);
  const txt = await r.text();
  const out: FxRates = {};
  // první dva řádky = datum a hlavička; pak měny
  for (const line of txt.trim().split(/\r?\n/).slice(2)) {
    const c = line.split("|");
    if (c.length < 5) continue;
    const amount = Number(c[2].replace(",", "."));
    const code = c[3].trim().toUpperCase();
    const rate = Number(c[4].replace(",", "."));
    if (code && Number.isFinite(amount) && amount > 0 && Number.isFinite(rate)) {
      out[code] = { rate, amount };
    }
  }
  return { ok: null, data: out };
}

// Přepočte částku v cizí měně na CZK kurzem ČNB k datu dokladu. CZK/prázdná → null.
export async function convertToCzk(
  amount: number,
  currency: string,
  docDate: string,
): Promise<FxConversion | null> {
  const cur = (currency || "").trim().toUpperCase();
  if (!cur || cur === "CZK" || !Number.isFinite(amount)) return null;
  const dateParam = cnbDateParam(docDate);
  const res = await cached<FxRates>("FX", dateParam, () => fetchCnb(dateParam));
  if (!res) return null;
  const row = res.data[cur];
  if (!row || !row.amount) return null;
  const perUnit = row.rate / row.amount;
  return { czk: amount * perUnit, perUnit, date: dateParam };
}

// --- Vyhodnocení jedné registrové kontroly ----------------------------------
export async function runRegistryCheck(
  type: CheckType,
  jsonKey: string,
  values: Record<string, unknown>,
): Promise<RegistryResult> {
  const val = (k: string) => String(values?.[k] ?? "").trim();
  try {
    switch (type) {
      case "ARES_SUBJECT": {
        const ico = val(jsonKey).replace(/\D/g, "");
        if (!ico) return { ok: null, message: "IČO nezadáno" };
        const padded = ico.padStart(8, "0");
        const res = await cached("ARES", padded, () => fetchAres(padded));
        if (!res) return { ok: null, message: "ARES nedostupný" };
        if (!res.data.exists) return { ok: false, message: "Subjekt v ARES neexistuje" };
        return res.data.active
          ? { ok: true, message: `Aktivní v ARES: ${res.data.name ?? ""}`.trim() }
          : { ok: false, message: "Subjekt je v ARES zaniklý" };
      }
      case "VAT_RELIABILITY": {
        const dic = val(jsonKey).replace(/\s/g, "").replace(/^CZ/i, "");
        if (!dic) return { ok: null, message: "DIČ nezadáno" };
        const res = await cached("VAT", dic, () => fetchVat(dic));
        if (!res) return { ok: null, message: "Registr DPH nedostupný" };
        if (!res.data.found) return { ok: null, message: "Plátce nenalezen v registru DPH" };
        return res.data.unreliable
          ? { ok: false, message: "NESPOLEHLIVÝ plátce DPH" }
          : { ok: true, message: "Spolehlivý plátce DPH" };
      }
      case "VAT_ACCOUNT_PUBLISHED": {
        const dic = val("DIČ").replace(/\s/g, "").replace(/^CZ/i, "");
        const acc = val(jsonKey);
        if (!dic || !acc) return { ok: null, message: "Chybí DIČ nebo číslo účtu" };
        const res = await cached("VAT", dic, () => fetchVat(dic));
        if (!res) return { ok: null, message: "Registr DPH nedostupný" };
        if (!res.data.found) return { ok: null, message: "Plátce nenalezen v registru DPH" };
        return accountPublished(acc, res.data.accounts)
          ? { ok: true, message: "Účet je zveřejněný plátcem DPH" }
          : { ok: false, message: "Účet NENÍ mezi zveřejněnými účty plátce" };
      }
      case "INSOLVENCY":
        return { ok: null, message: "Insolvence – zatím nekontrolováno" };
      default:
        return { ok: null, message: "Neznámá registrová kontrola" };
    }
  } catch {
    return { ok: null, message: "Registr nedostupný" };
  }
}

export const REGISTRY_CHECK_TYPES: CheckType[] = [
  "ARES_SUBJECT",
  "VAT_RELIABILITY",
  "VAT_ACCOUNT_PUBLISHED",
  "INSOLVENCY",
];
