import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { resolveWorkflowDisplay, parseAmount } from "@/lib/config";
import { runRegistryCheck, convertToCzk } from "@/lib/registries";
import { parseErpDate } from "@/lib/erp";
import { formatAmount } from "../types";
import { StatusBadge } from "../../StatusBadge";
import { DecideForm } from "./DecideForm";
import { DocsPanel } from "./DocsPanel";
import { EscClose } from "./EscClose";

function fmt(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

type HistoryEvent = { type?: string; user?: string; at?: string; comment?: string };

// Překlad druhů workflow kroků (enum2str z AX) do češtiny.
const TRACK_CS: Record<string, string> = {
  Submission: "Odesláno ke schválení",
  Submit: "Odesláno ke schválení",
  Approval: "Schváleno",
  Approved: "Schváleno",
  Rejection: "Zamítnuto",
  Rejected: "Zamítnuto",
  Completion: "Dokončeno",
  Completed: "Dokončeno",
  Delegation: "Delegováno",
  Escalation: "Eskalováno",
  RequestChange: "Vyžádána změna",
  ChangeRequest: "Vyžádána změna",
  Resubmit: "Znovu odesláno",
  Recall: "Staženo",
  Return: "Vráceno",
  Restart: "Restartováno",
  Terminate: "Ukončeno",
  Reassignment: "Přeřazeno",
};

function trackLabel(type: string | undefined, en: boolean): string {
  if (!type) return "–";
  if (en) return type;
  return TRACK_CS[type] ?? type;
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

  // Přepočet do účetní měny (u českých firem CZK). Primárně z dokladu – job
  // exportuje „Celkem v účetní měně" spočtené kurzem faktury (nebo nejbližším
  // kurzem z lístku). Když pole chybí (starší import), orientačně kurzem ČNB.
  const docCur = (display.currency ?? "").toUpperCase();
  const acctCur = String(regValues["Účetní měna"] ?? "").toUpperCase();
  const acctAmt = parseAmount(String(regValues["Celkem v účetní měně"] ?? ""));
  const dph = parseAmount(String(regValues["DPH"] ?? ""));
  const amountNum = parseAmount(display.amount);

  let conv: { amount: string; currency: string; note: string } | null = null;
  if (acctAmt !== null && acctCur && docCur && acctCur !== docCur) {
    conv = { amount: acctAmt.toFixed(2), currency: acctCur, note: t.detail.fxDoc };
  } else if (amountNum !== null && docCur && docCur !== "CZK" && acctCur !== docCur) {
    const fx = await convertToCzk(
      amountNum,
      display.currency ?? "",
      String(regValues["Datum dokladu"] ?? regValues["Datum faktury"] ?? ""),
    );
    if (fx) conv = { amount: fx.czk.toFixed(2), currency: "CZK", note: `${t.detail.fxNote} ${fx.date}` };
  }

  // Název společnosti z číselníku (jako v přehledu) + popis dokladu do hlavičky.
  const dataArea = await prisma.dataArea.findUnique({
    where: { code: workitem.dataAreaCode },
  });
  const companyName = dataArea?.name ?? null;
  const popis = String(regValues["Popis faktury"] ?? regValues["Popis"] ?? "").trim();

  // Průběh schvalování (kroky + komentáře) z ERP.
  const history: HistoryEvent[] = Array.isArray(workitem.workflow.history)
    ? (workitem.workflow.history as HistoryEvent[])
    : [];
  const en = (user?.locale ?? "cs").startsWith("en");

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
  // Panel příloh (a nahrávání) vidí řešitel workitemu nebo admin – tedy každý,
  // kdo smí detail otevřít. Zobrazíme ho i bez příloh, ať je kam nahrávat.
  const canUpload = isOwner || user?.role === "ADMIN";
  const showDocs = viewDocs.length > 0 || canUpload;

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
        {companyName ? `${companyName} (${workitem.dataAreaCode})` : workitem.dataAreaCode}
        {display.amount && (
          <>
            {" · "}
            <span className="font-semibold text-fg">
              {formatAmount(display.amount)}
              {display.currency ? ` ${display.currency}` : ""}
            </span>
            {dph !== null && dph > 0 && (
              <span className="text-muted">
                {` · ${t.detail.vat} `}
                <span className="text-fg">
                  {formatAmount(dph.toFixed(2))}
                  {display.currency ? ` ${display.currency}` : ""}
                </span>
              </span>
            )}
            {conv && (
              <span className="text-muted">
                {" ≈ "}
                <span className="font-semibold text-fg">
                  {formatAmount(conv.amount)} {conv.currency}
                </span>
                {` (${conv.note})`}
              </span>
            )}
          </>
        )}
      </p>

      <div className={showDocs ? "grid gap-6 lg:grid-cols-2 lg:items-start" : "max-w-3xl"}>
        <div className="space-y-6">
          {popis && (
            <section className="rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.docDescription}</h2>
              <p className="whitespace-pre-wrap text-fg">{popis}</p>
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
                      <td className="px-4 py-2.5 text-fg">
                        {f.role === "AMOUNT" ? (
                          <span className="font-semibold">
                            {formatAmount(f.value) ?? "–"}
                            {display.currency ? ` ${display.currency}` : ""}
                          </span>
                        ) : (
                          f.value || "–"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {display.checks.length > 0 && (
            <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-2 text-sm font-semibold text-muted">{t.detail.autoChecks}</h2>
              <ul className="space-y-1 text-sm">
                {display.checks.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-2">
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

          {history.length > 0 && (
            <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
              <h2 className="mb-3 text-sm font-semibold text-muted">{t.detail.history}</h2>
              <ol className="space-y-3">
                {history.map((ev, i) => {
                  const at = parseErpDate(ev.at);
                  return (
                    <li key={i} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-fg">
                          <span className="font-medium">{trackLabel(ev.type, en)}</span>
                          {ev.user && <span className="text-muted"> · {ev.user}</span>}
                          {at && <span className="text-muted"> · {fmt(at)}</span>}
                        </p>
                        {ev.comment && (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                            „{ev.comment}"
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

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

        {showDocs && (
          <div className="lg:sticky lg:top-20">
            <DocsPanel
              workitemId={workitem.id}
              docs={viewDocs}
              demoNote={demoDocs}
              canUpload={canUpload}
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  );
}
