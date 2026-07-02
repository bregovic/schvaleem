import { parseErpDate } from "@/lib/erp";

// Zobrazovací model „informací z workflow" (odeslal + řešitel + průběh).
// Staví se na serveru (detail i seznam), do klienta jde už jen hotové stringy.
export type WfEvent = {
  label: string;
  who: string | null;
  at: string | null;
  comment: string | null;
};

export type WfInfo = {
  odeslalName: string | null;
  odeslalAt: string | null;
  resitelName: string | null;
  events: WfEvent[];
};

type HistoryEvent = {
  type?: string;
  user?: string;
  userName?: string;
  at?: string;
  comment?: string;
};

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

export function trackLabel(type: string | undefined, en: boolean): string {
  if (!type) return "–";
  if (en) return type;
  return TRACK_CS[type] ?? type;
}

function isSubmission(type: string | undefined): boolean {
  return type === "Submission" || type === "Submit";
}

function fmt(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function buildWorkflowInfo(input: {
  history: unknown;
  originator: string | null;
  originatorName: string | null;
  originatorAt: Date | null; // erpCreatedAt (kdy vzniklo workflow)
  assigneeName: string | null;
  assigneeId: string | null;
  locale: string | null | undefined;
}): WfInfo {
  const en = (input.locale ?? "cs").startsWith("en");
  const raw: HistoryEvent[] = Array.isArray(input.history)
    ? (input.history as HistoryEvent[])
    : [];

  // „Odeslal" bereme z kroku Submission (má jméno i čas); fallback originator.
  const sub = raw.find((e) => isSubmission(e.type));
  const odeslalName =
    sub?.userName ||
    sub?.user ||
    input.originatorName ||
    input.originator ||
    null;
  const odeslalAt = fmt(sub ? parseErpDate(sub.at) : input.originatorAt);

  // Časová osa = ostatní kroky (odeslání je už v řádku „Odeslal").
  const events: WfEvent[] = raw
    .filter((e) => !isSubmission(e.type))
    .map((e) => ({
      label: trackLabel(e.type, en),
      who: e.userName || e.user || null,
      at: fmt(parseErpDate(e.at)),
      comment: e.comment || null,
    }));

  return {
    odeslalName,
    odeslalAt,
    resitelName: input.assigneeName || input.assigneeId || null,
    events,
  };
}

// Má blok co zobrazit?
export function hasWfInfo(wf: WfInfo | null | undefined): boolean {
  return !!wf && (!!wf.odeslalName || !!wf.resitelName || wf.events.length > 0);
}
