// Parsování data z ERP – přijme ISO i český formát "dd.MM.yyyy HH:mm:ss".
export function parseErpDate(input?: string | null): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  const cz = s.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (cz) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = cz;
    // Ukládáme jako UTC „wall-clock" – časy z ERP se pak zobrazí beze změny
    // nezávisle na časové zóně serveru (lokál vs Railway UTC).
    const ms = Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    return isNaN(ms) ? null : new Date(ms);
  }

  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

// Normalizace dataAreaId (ContextCompanyId) – ERP posílá různou velikostí písmen.
export function normalizeDataArea(code: string): string {
  return code.trim().toUpperCase();
}
