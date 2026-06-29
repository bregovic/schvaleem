import "server-only";
import { prisma } from "@/lib/prisma";
import { runCheck } from "@/lib/checks";
import type { CheckType, FieldRole, Workflow } from "@/generated/prisma/client";

// Registrové kontroly běží online (na detailu, async) – ne v synchronní sadě.
const REGISTRY_TYPES = new Set<CheckType>([
  "ARES_SUBJECT",
  "VAT_RELIABILITY",
  "VAT_ACCOUNT_PUBLISHED",
  "INSOLVENCY",
]);

export type DisplayField = {
  key: string;
  label: string;
  value: string;
  role: FieldRole;
};

export type CheckOutcome = {
  label: string;
  ok: boolean | null;
  message: string;
};

export type WorkflowDisplay = {
  title: string;
  hasTitle: boolean; // byl titulek určen polem s rolí TITLE?
  amount: string | null;
  currency: string | null;
  fields: DisplayField[]; // pole pro detail (bez skrytých)
  previewFields: DisplayField[]; // pole zvolená do náhledu hlavičky
  checks: CheckOutcome[]; // výsledky lokálních automatických kontrol
  registryChecks: { type: CheckType; jsonKey: string; label: string }[]; // online registry (běží na detailu)
  suggestedAction: "APPROVE" | "REJECT" | null; // návrh akce
  priority: "high" | "normal";
  rules: {
    requireCommentOnReject: boolean;
    requireCommentOnApprove: boolean;
    amountThreshold: number | null;
    thresholdAction: "NONE" | "REQUIRE_COMMENT" | "BLOCK";
  };
};

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const DEFAULT_RULES: WorkflowDisplay["rules"] = {
  requireCommentOnReject: true,
  requireCommentOnApprove: false,
  amountThreshold: null,
  thresholdAction: "NONE",
};

export function parseAmount(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function resolveWorkflowDisplay(
  workflow: Pick<
    Workflow,
    "organizationId" | "documentType" | "recordId" | "values"
  >,
): Promise<WorkflowDisplay> {
  const values = (workflow.values as Record<string, unknown>) ?? {};

  const config = workflow.organizationId
    ? await prisma.documentTypeConfig.findUnique({
        where: {
          organizationId_documentType: {
            organizationId: workflow.organizationId,
            documentType: workflow.documentType,
          },
        },
        include: {
          fields: { orderBy: { order: "asc" } },
          checks: { orderBy: { order: "asc" } },
        },
      })
    : null;

  let title = workflow.recordId
    ? `${workflow.documentType} · ${workflow.recordId}`
    : workflow.documentType;
  let hasTitle = false;
  let amount: string | null = null;
  let currency: string | null = null;
  const fields: DisplayField[] = [];
  const previewFields: DisplayField[] = [];

  const rules = config
    ? {
        requireCommentOnReject: config.requireCommentOnReject,
        requireCommentOnApprove: config.requireCommentOnApprove,
        amountThreshold: config.amountThreshold ? Number(config.amountThreshold) : null,
        thresholdAction: config.thresholdAction,
      }
    : DEFAULT_RULES;

  if (config && config.fields.length > 0) {
    for (const f of config.fields) {
      const value = asText(values[f.jsonKey]);
      if (f.role === "TITLE" && value) {
        title = value;
        hasTitle = true;
      } else if (f.role === "AMOUNT") amount = value || null;
      else if (f.role === "CURRENCY") currency = value || null;
      if (f.role !== "HIDDEN") {
        const df: DisplayField = { key: f.jsonKey, label: f.label, value, role: f.role };
        fields.push(df);
        if (f.preview) previewFields.push(df);
      }
    }
  } else {
    for (const [k, v] of Object.entries(values)) {
      fields.push({ key: k, label: k, value: asText(v), role: "DETAIL" });
    }
  }

  // Automatické kontroly – lokální (synchronní) vs. registrové (online, na detailu)
  const allChecks = config?.checks ?? [];
  const checks: CheckOutcome[] = allChecks
    .filter((ch) => !REGISTRY_TYPES.has(ch.type))
    .map((ch) => {
      const res = runCheck(ch.type, asText(values[ch.jsonKey]));
      return { label: ch.label, ok: res.ok, message: res.message };
    });
  const registryChecks = allChecks
    .filter((ch) => REGISTRY_TYPES.has(ch.type))
    .map((ch) => ({ type: ch.type, jsonKey: ch.jsonKey, label: ch.label }));

  // Návrh akce + priorita
  const amountNum = parseAmount(amount);
  const overThreshold =
    rules.amountThreshold !== null && amountNum !== null && amountNum > rules.amountThreshold;
  const hasFailedCheck = checks.some((c) => c.ok === false);
  const priority: "high" | "normal" = overThreshold || hasFailedCheck ? "high" : "normal";
  const suggestedAction: "APPROVE" | null =
    !hasFailedCheck && !overThreshold ? "APPROVE" : null;

  return {
    title,
    hasTitle,
    amount,
    currency,
    fields,
    previewFields,
    checks,
    registryChecks,
    suggestedAction,
    priority,
    rules,
  };
}
