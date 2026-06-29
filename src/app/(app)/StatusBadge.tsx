import type { WorkitemStatus } from "@/generated/prisma/client";

const MAP: Record<WorkitemStatus, { label: string; cls: string }> = {
  PENDING: { label: "Čeká", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Schváleno", cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "Zamítnuto", cls: "bg-red-100 text-red-800" },
  COMPLETED_BY_SYSTEM: { label: "Uzavřeno systémem", cls: "bg-slate-200 text-slate-700" },
};

export function StatusBadge({ status }: { status: WorkitemStatus }) {
  const { label, cls } = MAP[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
