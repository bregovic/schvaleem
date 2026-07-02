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

  const items: ApprovalItem[] = await Promise.all(
    workitems.map(async (w) => {
      const d = await resolveWorkflowDisplay(w.workflow);
      const wfValues = (w.workflow.values as Record<string, unknown>) ?? {};
      const popis = String(wfValues["Popis faktury"] ?? wfValues["Popis"] ?? "").trim() || null;
      const invoiceNo =
        String(
          wfValues["Číslo faktury"] ??
            wfValues["Číslo žádanky"] ??
            wfValues["Číslo zálohové faktury"] ??
            wfValues["Číslo faktury dodavatele"] ??
            "",
        ).trim() || null;
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

      // Titulek: konfigurované TITLE pole > popis dokladu (label) > výchozí.
      // Subject (instrukce "Proveďte schválení…") se jako titulek nepoužívá.
      const title = d.hasTitle ? d.title : w.workflow.label || d.title;

      // Haystack pro hledání: titulek, popis, originator, typ + všechny hodnoty
      // (pokryje dodavatele, IČO, DIČ, č. faktury, variabilní symbol, popis…).
      const search = [
        title,
        popis,
        w.workflow.originator,
        w.workflow.originatorName,
        w.assigneeName,
        tn,
        ...Object.values(wfValues).map((v) =>
          v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v),
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const dueMs = w.dueAt ? w.dueAt.getTime() : null;
      const overdue = dueMs !== null && dueMs < now;
      // „Priorita" = jen po splatnosti (ne limit/kontroly/blízký termín).
      const priority: "high" | "normal" = overdue ? "high" : "normal";

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
        popis,
        invoiceNo,
        search,
        originator: w.workflow.originatorName ?? w.workflow.originator,
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
