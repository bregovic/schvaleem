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
  deferred: boolean;
  previewFields: PreviewFieldC[];
  checks: CheckOutcomeC[];
  suggestedAction: "APPROVE" | "REJECT" | null;
  priority: "high" | "normal";
  requireCommentOnReject: boolean;
  approveBlocked: boolean;
};

export function amountLabel(it: { amount: string | null; currency: string | null }) {
  if (!it.amount) return null;
  return `${it.amount}${it.currency ? " " + it.currency : ""}`;
}
