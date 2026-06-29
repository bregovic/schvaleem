import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDict } from "@/lib/i18n";
import { resolveWorkflowDisplay, parseAmount } from "@/lib/config";
import { ApprovalHub } from "./ApprovalHub";
import type { ApprovalItem } from "./types";

export default async function ZaznamyPage() {
  const user = await getCurrentUser();
  const t = getDict(user?.locale);

  if (!user?.erpUserId) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-fg">{t.records.erpMissingTitle}</h1>
        <p className="rounded-lg bg-surface p-6 text-muted ring-1 ring-line">
          {t.records.erpMissing}
        </p>
      </div>
    );
  }

  const [workitems, dataAreas, configs] = await Promise.all([
    prisma.workitem.findMany({
      where: { assigneeErpUserId: user.erpUserId, status: "PENDING" },
      include: {
        workflow: {
          include: { organization: true, _count: { select: { documents: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dataArea.findMany(),
    prisma.documentTypeConfig.findMany({ select: { organizationId: true, documentType: true, name: true } }),
  ]);

  const areaName = new Map(dataAreas.map((a) => [a.code, a.name]));
  const typeName = new Map(
    configs.map((c) => [`${c.organizationId}:${c.documentType}`, c.name]),
  );

  const now = Date.now();
  const SOON = 2 * 24 * 60 * 60 * 1000; // 2 dny

  const items: ApprovalItem[] = await Promise.all(
    workitems.map(async (w) => {
      const d = await resolveWorkflowDisplay(w.workflow);
      const amount = parseAmount(d.amount);
      const approveBlocked =
        d.rules.thresholdAction === "BLOCK" &&
        d.rules.amountThreshold !== null &&
        amount !== null &&
        amount > d.rules.amountThreshold;
      const tn =
        (w.workflow.organizationId &&
          typeName.get(`${w.workflow.organizationId}:${w.workflow.documentType}`)) ||
        w.workflow.documentType;

      // Titulek: konfigurované TITLE pole > Subject z ERP > popis dokladu > výchozí
      const title = d.hasTitle ? d.title : w.subject || w.workflow.label || d.title;

      const dueMs = w.dueAt ? w.dueAt.getTime() : null;
      const overdue = dueMs !== null && dueMs < now;
      const dueSoon = dueMs !== null && dueMs < now + SOON;
      const priority: "high" | "normal" =
        d.priority === "high" || overdue || dueSoon ? "high" : "normal";

      return {
        id: w.id,
        org: w.workflow.organization?.name ?? "Nezařazené",
        title,
        amount: d.amount,
        currency: d.currency,
        documentType: w.workflow.documentType,
        documentTypeName: tn,
        dataArea: w.dataAreaCode,
        dataAreaName: areaName.get(w.dataAreaCode) ?? null,
        createdAt: w.createdAt.toISOString(),
        subject: w.subject,
        originator: w.workflow.originator,
        dueAt: w.dueAt ? w.dueAt.toISOString() : null,
        overdue,
        deferred: !!w.deferredAt,
        docCount: w.workflow._count.documents,
        previewFields: d.previewFields.map((f) => ({ label: f.label, value: f.value })),
        checks: d.checks,
        suggestedAction: d.suggestedAction,
        priority,
        requireCommentOnReject: d.rules.requireCommentOnReject,
        approveBlocked,
      };
    }),
  );

  // Odložené na konec; pak priorita (vysoká dřív); pak nejstarší první.
  items.sort((a, b) => {
    if (a.deferred !== b.deferred) return a.deferred ? 1 : -1;
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return <ApprovalHub items={items} t={t} />;
}
