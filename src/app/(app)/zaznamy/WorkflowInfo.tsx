import type { Dict } from "@/lib/i18n";
import type { WfInfo } from "./workflow-info";

// Prezentační blok „informace z workflow". Bez klientských hooků – použitelný
// v server (detail) i klient (seznam, swipe) komponentách. Data už jsou hotová.
export function WorkflowInfo({
  wf,
  t,
  variant = "full",
  maxEvents,
}: {
  wf: WfInfo;
  t: Dict;
  variant?: "full" | "compact";
  maxEvents?: number;
}) {
  const shown =
    maxEvents != null && wf.events.length > maxEvents
      ? wf.events.slice(-maxEvents)
      : wf.events;
  const hiddenCount = wf.events.length - shown.length;

  if (variant === "compact") {
    return (
      <div className="mt-2 border-t border-line pt-2 text-xs text-muted">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {wf.odeslalName && (
            <span>
              {t.detail.submittedBy}:{" "}
              <span className="text-fg">{wf.odeslalName}</span>
              {wf.odeslalAt ? ` · ${wf.odeslalAt}` : ""}
            </span>
          )}
          {wf.resitelName && (
            <span>
              {t.detail.assignee}:{" "}
              <span className="text-fg">{wf.resitelName}</span>
            </span>
          )}
        </div>
        {shown.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {shown.map((ev, i) => (
              <li key={i}>
                <span className="text-fg">{ev.label}</span>
                {ev.who ? ` · ${ev.who}` : ""}
                {ev.at ? ` · ${ev.at}` : ""}
                {ev.comment ? ` – „${ev.comment}"` : ""}
              </li>
            ))}
            {hiddenCount > 0 && (
              <li className="text-muted/70">+{hiddenCount} {t.detail.moreSteps}</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  // full – sekce na detailu
  return (
    <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <h2 className="mb-3 text-sm font-semibold text-muted">{t.detail.history}</h2>
      <div className="mb-3 space-y-1 text-sm">
        {wf.odeslalName && (
          <p>
            <span className="text-muted">{t.detail.submittedBy}: </span>
            <span className="text-fg">{wf.odeslalName}</span>
            {wf.odeslalAt && <span className="text-muted"> · {wf.odeslalAt}</span>}
          </p>
        )}
        {wf.resitelName && (
          <p>
            <span className="text-muted">{t.detail.assignee}: </span>
            <span className="text-fg">{wf.resitelName}</span>
          </p>
        )}
      </div>
      {wf.events.length > 0 && (
        <ol className="space-y-3 border-t border-line pt-3">
          {wf.events.map((ev, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg">
                  <span className="font-medium">{ev.label}</span>
                  {ev.who && <span className="text-muted"> · {ev.who}</span>}
                  {ev.at && <span className="text-muted"> · {ev.at}</span>}
                </p>
                {ev.comment && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                    „{ev.comment}"
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
