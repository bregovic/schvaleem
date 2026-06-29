import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveWorkflowDisplay } from "@/lib/config";
import { StatusBadge } from "../../StatusBadge";
import { DecideForm } from "./DecideForm";

function fmt(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function WorkitemDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const workitem = await prisma.workitem.findUnique({
    where: { id },
    include: {
      workflow: {
        include: { organization: true, documents: { orderBy: { createdAt: "asc" } } },
      },
      decidedBy: true,
    },
  });

  if (!workitem) notFound();

  // Vidět smí jen řešitel workitemu nebo administrátor.
  const isOwner = !!user?.erpUserId && workitem.assigneeErpUserId === user.erpUserId;
  if (!isOwner && user?.role !== "ADMIN") notFound();

  const display = await resolveWorkflowDisplay(workitem.workflow);
  const visibleFields = display.fields.filter((f) => f.role !== "HIDDEN");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/zaznamy" className="text-sm text-slate-500 hover:underline">
        ← Zpět ke schvalování
      </Link>

      <div className="mt-3 mb-1 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-brand">{display.title}</h1>
        <StatusBadge status={workitem.status} />
      </div>
      <p className="mb-6 text-sm text-slate-500">
        {workitem.workflow.organization?.name ?? "Nezařazené"} ·{" "}
        {workitem.workflow.documentType} · {workitem.dataAreaCode}
        {display.amount && (
          <>
            {" · "}
            <span className="font-medium text-brand">
              {display.amount}
              {display.currency ? ` ${display.currency}` : ""}
            </span>
          </>
        )}
      </p>

      <section className="mb-6 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Data dokumentu
        </h2>
        {visibleFields.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400">Žádná data.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {visibleFields.map((f) => (
                <tr key={f.key}>
                  <td className="w-1/3 px-4 py-2.5 font-medium text-slate-500">{f.label}</td>
                  <td className="px-4 py-2.5 text-brand">{f.value || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-6 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Dokumenty ({workitem.workflow.documents.length})
        </h2>
        {workitem.workflow.documents.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400">Žádné PDF dokumenty.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {workitem.workflow.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-brand">{d.filename}</span>
                <a
                  href={`/dokument/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-accent hover:underline"
                >
                  Otevřít
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {workitem.status === "PENDING" && isOwner ? (
        <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Rozhodnutí</h2>
          <DecideForm workitemId={workitem.id} />
        </section>
      ) : (
        <section className="rounded-lg bg-white p-4 text-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Rozhodnutí</h2>
          <p className="text-slate-600">
            {workitem.action ?? workitem.status} ·{" "}
            <span className="text-brand">
              {workitem.decidedBy?.name ?? workitem.decidedBy?.email ?? "–"}
            </span>{" "}
            · {fmt(workitem.decidedAt)}
          </p>
          {workitem.comment && (
            <p className="mt-1 text-slate-600">Komentář: {workitem.comment}</p>
          )}
        </section>
      )}
    </div>
  );
}
