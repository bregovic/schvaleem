import { randomBytes } from "crypto";

// Krátké, čitelné ID s prefixem podle typu (rec_, doc_).
function shortId(): string {
  return randomBytes(9).toString("base64url");
}

export function recordId(): string {
  return `rec_${shortId()}`;
}

export function documentId(): string {
  return `doc_${shortId()}`;
}

// API klíč: zobrazitelný prefix + tajná část. Klíč ukládáme jen jako hash.
export function generateApiKey(): { key: string; prefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `sk_${secret}`;
  return { key, prefix: key.slice(0, 11) };
}
