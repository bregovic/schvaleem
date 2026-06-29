import type { WorkitemStatus } from "@/generated/prisma/client";
import type { Dict } from "@/lib/i18n";

const CLS: Record<WorkitemStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  COMPLETED_BY_SYSTEM: "bg-surface-2 text-muted",
};

export function StatusBadge({ status, t }: { status: WorkitemStatus; t: Dict }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CLS[status]}`}>
      {t.status[status]}
    </span>
  );
}
