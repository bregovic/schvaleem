// Offline automatické kontroly nad hodnotami dokumentu (bez externích služeb).
import type { CheckType } from "@/generated/prisma/client";

export type CheckResult = {
  ok: boolean | null; // true = ok, false = chyba, null = nelze ověřit (prázdné)
  message: string;
};

// --- Český bankovní účet: modulo 11 (předčíslí i základní část) ---
const WEIGHTS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]; // zprava

function moduloOk(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, "");
  if (!digits || digits.length > 10) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    sum += d * WEIGHTS[i];
  }
  return sum % 11 === 0;
}

function checkBankAccountCz(value: string): CheckResult {
  const v = value.trim();
  if (!v) return { ok: null, message: "Účet nezadán" };
  // formát [předčíslí-]číslo/kódbanky
  const m = v.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return { ok: false, message: "Neplatný formát čísla účtu" };
  const [, prefix, base] = m;
  const baseOk = moduloOk(base);
  const prefixOk = !prefix || moduloOk(prefix);
  if (baseOk && prefixOk) return { ok: true, message: "Číslo účtu je platné (modulo)" };
  if (!prefixOk && !baseOk) return { ok: false, message: "Neplatné předčíslí i číslo účtu" };
  if (!prefixOk) return { ok: false, message: "Neplatné předčíslí účtu" };
  return { ok: false, message: "Neplatné číslo účtu (modulo)" };
}

// --- IČO: kontrolní číslice (modulo 11) ---
function checkIcoCz(value: string): CheckResult {
  const d = value.replace(/\D/g, "");
  if (!d) return { ok: null, message: "IČO nezadáno" };
  const ico = d.padStart(8, "0");
  if (ico.length !== 8) return { ok: false, message: "IČO musí mít 8 číslic" };
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i);
  const r = sum % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === Number(ico[7])
    ? { ok: true, message: "IČO má platnou kontrolní číslici" }
    : { ok: false, message: "Neplatné IČO (kontrolní číslice)" };
}

// --- IBAN: mod 97 == 1 ---
function checkIban(value: string): CheckResult {
  const s = value.replace(/\s+/g, "").toUpperCase();
  if (!s) return { ok: null, message: "IBAN nezadán" };
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(s)) {
    return { ok: false, message: "Neplatný formát IBAN" };
  }
  const rearranged = s.slice(4) + s.slice(0, 4);
  const converted = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of converted) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1
    ? { ok: true, message: "IBAN je platný" }
    : { ok: false, message: "Neplatný IBAN (kontrolní součet)" };
}

// --- DIČ CZ: formát ---
function checkDicCz(value: string): CheckResult {
  const v = value.replace(/\s+/g, "").toUpperCase();
  if (!v) return { ok: null, message: "DIČ nezadáno" };
  return /^CZ\d{8,10}$/.test(v)
    ? { ok: true, message: "DIČ má platný formát" }
    : { ok: false, message: "Neplatný formát DIČ (CZ + 8–10 číslic)" };
}

export function runCheck(type: CheckType, value: string): CheckResult {
  switch (type) {
    case "BANK_ACCOUNT_CZ":
      return checkBankAccountCz(value);
    case "ICO_CZ":
      return checkIcoCz(value);
    case "IBAN":
      return checkIban(value);
    case "DIC_CZ":
      return checkDicCz(value);
    default:
      return { ok: null, message: "Neznámá kontrola" };
  }
}

export const CHECK_LABELS: Record<CheckType, string> = {
  BANK_ACCOUNT_CZ: "Bankovní účet (modulo)",
  ICO_CZ: "IČO",
  IBAN: "IBAN",
  DIC_CZ: "DIČ",
};
