import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveWorkflowDisplay } from "@/lib/config";
import { ApprovalList, type ApprovalItem } from "./ApprovalList";

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

  const workitems = await prisma.workitem.findMany({
    where: { assigneeErpUserId: user.erpUserId, status: "PENDING" },
    include: { workflow: { include: { organization: true } } },
    orderBy: { createdAt: "asc" }, // nejstarší první
  });

  const items: ApprovalItem[] = await Promise.all(
    workitems.map(async (w) => {
      const d = await resolveWorkflowDisplay(w.workflow);
      return {
        id: w.id,
        org: w.workflow.organization?.name ?? "Nezařazené",
        title: d.title,
        amount: d.amount,
        currency: d.currency,
        documentType: w.workflow.documentType,
        dataArea: w.dataAreaCode,
        createdAt: w.createdAt.toISOString(),
      };
    }),
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-brand">Ke schválení</h1>
      <p className="mb-6 text-sm text-slate-500">
        Tvé workitemy, nejstarší první. Vyber víc položek a rozhodni hromadně, nebo přepni
        na režim swipe.
      </p>
      <ApprovalList items={items} />
    </div>
  );
}
