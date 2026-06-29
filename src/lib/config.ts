import "server-only";
import { prisma } from "@/lib/prisma";
import { runCheck } from "@/lib/checks";
import type { FieldRole, Workflow } from "@/generated/prisma/client";

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
  amount: string | null;
  currency: string | null;
  fields: DisplayField[]; // pole pro detail (bez skrytých)
  previewFields: DisplayField[]; // pole zvolená do náhledu hlavičky
  checks: CheckOutcome[]; // výsledky automatických kontrol
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
      if (f.role === "TITLE" && value) title = value;
      else if (f.role === "AMOUNT") amount = value || null;
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

  // Automatické kontroly
  const checks: CheckOutcome[] = (config?.checks ?? []).map((ch) => {
    const res = runCheck(ch.type, asText(values[ch.jsonKey]));
    return { label: ch.label, ok: res.ok, message: res.message };
  });

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
    amount,
    currency,
    fields,
    previewFields,
    checks,
    suggestedAction,
    priority,
    rules,
  };
}
