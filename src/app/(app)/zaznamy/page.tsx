import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveWorkflowDisplay, parseAmount } from "@/lib/config";
import { ApprovalHub } from "./ApprovalHub";
import type { ApprovalItem } from "./types";

export default async function ZaznamyPage() {
  const user = await getCurrentUser();

  if (!user?.erpUserId) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-brand">Ke schválení</h1>
        <p className="rounded-lg bg-white p-6 text-slate-500 ring-1 ring-slate-200">
          Tvůj účet nemá přiřazené <strong>ERP userId</strong>, takže ti nechodí žádné
          workitemy ke schválení. Doplň ho ve Správě (jen administrátor).
        </p>
      </div>
    );
  }

  const [workitems, dataAreas, configs] = await Promise.all([
    prisma.workitem.findMany({
      where: { assigneeErpUserId: user.erpUserId, status: "PENDING" },
      include: { workflow: { include: { organization: true } } },
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

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-brand">Ke schválení</h1>
      <p className="mb-5 text-sm text-slate-500">
        Swipe (vpravo schválit, vlevo zamítnout, dolů odložit, nahoru na konec), nebo seznam s
        hromadným výběrem.
      </p>
      <ApprovalHub items={items} />
    </div>
  );
}
