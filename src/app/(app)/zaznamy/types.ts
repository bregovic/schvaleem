export type CheckOutcomeC = { label: string; ok: boolean | null; message: string };
export type PreviewFieldC = { label: string; value: string };

export type ApprovalItem = {
  id: string;
  org: string;
  title: string;
  amount: string | null;
  currency: string | null;
  documentType: string;
  documentTypeName: string;
  dataArea: string;
  dataAreaName: string | null;
  createdAt: string;
  subject: string | null;
  popis: string | null;
  search: string; // předpočítaný haystack (lowercase) pro fulltext filtr
  originator: string | null;
  dueAt: string | null; // ISO
  overdue: boolean;
  deferred: boolean;
  docCount: number;
  previewFields: PreviewFieldC[];
  checks: CheckOutcomeC[];
  suggestedAction: "APPROVE" | "REJECT" | null;
  priority: "high" | "normal";
  requireCommentOnReject: boolean;
  approveBlocked: boolean;
};

// Účetní formát: oddělené tisíce + 2 desetinná místa (cs-CZ). Nečíselné nechá být.
export function formatAmount(amount: string | null): string | null {
  if (!amount) return null;
  const n = Number(String(amount).replace(/\s/g, "").replace(",", "."));
  if (!isFinite(n)) return amount;
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function amountLabel(it: { amount: string | null; currency: string | null }) {
  const a = formatAmount(it.amount);
  if (!a) return null;
  return `${a}${it.currency ? " " + it.currency : ""}`;
}
