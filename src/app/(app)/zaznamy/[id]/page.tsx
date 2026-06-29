import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { resolveWorkflowDisplay } from "@/lib/config";
import { runRegistryCheck } from "@/lib/registries";
import { StatusBadge } from "../../StatusBadge";
import { DecideForm } from "./DecideForm";
import { EscClose } from "./EscClose";
import { Instructions } from "./Instructions";

function fmt(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

// ERP časy (dueAt apod.) ukládáme jako UTC wall-clock → zobrazit v UTC beze změny.
function fmtErp(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(d);
}

export default async function WorkitemDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const t = getDict(user?.locale);

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

  // Online kontroly z veřejných registrů (ARES, DPH) – jen na detailu, cachované.
  const regValues = (workitem.workflow.values ?? {}) as Record<string, unknown>;
  const registryResults = await Promise.all(
    display.registryChecks.map(async (rc) => ({
      label: rc.label,
      ...(await runRegistryCheck(rc.type, rc.jsonKey, regValues)),
    })),
  );

  // Dokumenty k náhledu. V testovacím režimu (env SCHVALEEM_DEMO_PDF=1) se při
  // chybějícím skenu zobrazí náhodné PDF ze systému – v ostré verzi NIKDY.
  let viewDocs = workitem.workflow.documents.map((d) => ({ id: d.id, filename: d.filename }));
  let demoDocs = false;
  if (viewDocs.length === 0 && process.env.SCHVALEEM_DEMO_PDF === "1") {
    const count = await prisma.document.count();
    if (count > 0) {
      const picked = await prisma.document.findMany({
        skip: Math.floor(Math.random() * count),
        take: 1,
        select: { id: true, filename: true },
      });
      if (picked.length) {
        viewDocs = picked;
        demoDocs = true;
      }
    }
  }
  const hasDocs = viewDocs.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <EscClose />
      <Link href="/zaznamy" className="text-sm text-muted hover:underline">
        {t.detail.back}
      </Link>

      <div className="mt-3 mb-1 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-fg">{display.title}</h1>
        <StatusBadge status={workitem.status} t={t} />
      </div>
      <p className="mb-6 text-sm text-muted">
        {workitem.workflow.organization?.name ?? t.detail.unassigned} ·{" "}
        {workitem.workflow.documentType} · {workitem.dataAreaCode}
        {display.amount && (
          <>
            {" · "}
            <span className="font-semibold text-fg">
              {display.amount}
              {display.currency ? ` ${display.currency}` : ""}
            </span>
          </>
        )}
      </p>

      <div className={hasDocs ? "grid gap-6 lg:grid-cols-2 lg:items-start" : "max-w-3xl"}>
        <div className="space-y-6">
          {(workitem.subject ||
            workitem.description ||
            workitem.dueAt ||
            workitem.workflow.originator ||
            workitem.workflow.label) && (
            <section className="rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.assignment}</h2>
              {workitem.workflow.label && (
                <p className="text-fg">{t.detail.docLabel}: {workitem.workflow.label}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
                {workitem.dueAt && <span>{t.detail.due}: {fmtErp(workitem.dueAt)}</span>}
                {workitem.workflow.originator && (
                  <span>{t.detail.originator}: {workitem.workflow.originator}</span>
                )}
                {workitem.workflow.documentTypeName && (
                  <span>{t.detail.type}: {workitem.workflow.documentTypeName}</span>
                )}
              </div>
              <div className="mt-3">
                <Instructions t={t} subject={workitem.subject} description={workitem.description} />
              </div>
            </section>
          )}

          {display.checks.length > 0 && (
            <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.autoChecks}</h2>
              <ul className="space-y-1 text-sm">
                {display.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span
                      className={
                        c.ok === true ? "text-green-500" : c.ok === false ? "text-red-500" : "text-muted"
                      }
                    >
                      {c.ok === true ? "✓" : c.ok === false ? "✕" : "•"}
                    </span>
                    <span className="font-medium text-fg">{c.label}:</span>
                    <span className="text-muted">{c.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {registryResults.length > 0 && (
            <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.registries}</h2>
              <ul className="space-y-1 text-sm">
                {registryResults.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span
                      className={
                        c.ok === true ? "text-green-500" : c.ok === false ? "text-red-500" : "text-muted"
                      }
                    >
                      {c.ok === true ? "✓" : c.ok === false ? "✕" : "•"}
                    </span>
                    <span className="font-medium text-fg">{c.label}:</span>
                    <span className="text-muted">{c.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
            <h2 className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
              {t.detail.docData}
            </h2>
            {visibleFields.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">{t.detail.noData}</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {visibleFields.map((f) => (
                    <tr key={f.key}>
                      <td className="w-1/3 px-4 py-2.5 font-medium text-muted">{f.label}</td>
                      <td className="px-4 py-2.5 text-fg">{f.value || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {workitem.status === "PENDING" && isOwner ? (
            <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-3 text-sm font-semibold text-muted">{t.detail.decision}</h2>
              <DecideForm workitemId={workitem.id} t={t} />
            </section>
          ) : (
            <section className="rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.decision}</h2>
              <p className="text-muted">
                {workitem.action ?? workitem.status} ·{" "}
                <span className="text-fg">
                  {workitem.decidedBy?.name ?? workitem.decidedBy?.email ?? "–"}
                </span>{" "}
                · {fmt(workitem.decidedAt)}
              </p>
              {workitem.comment && (
                <p className="mt-1 text-muted">{t.detail.comment}: {workitem.comment}</p>
              )}
            </section>
          )}
        </div>

        {hasDocs && (
          <div className="lg:sticky lg:top-20">
            <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              <h2 className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
                <span>{t.detail.documents} ({viewDocs.length})</span>
                {demoDocs && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-normal text-amber-300">
                    {t.detail.demoNote}
                  </span>
                )}
              </h2>
              <ul className="divide-y divide-line">
                {viewDocs.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-fg">{d.filename}</span>
                      <a
                        href={`/dokument/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {t.detail.open}
                      </a>
                    </div>
                    <iframe
                      src={`/dokument/${d.id}#view=FitH`}
                      title={d.filename}
                      className="h-[60vh] w-full rounded-md border border-line bg-surface-2 sm:h-[78vh]"
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
