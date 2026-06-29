import "server-only";
import { prisma } from "@/lib/prisma";
import type { FieldRole, Workflow } from "@/generated/prisma/client";

export type DisplayField = {
  key: string;
  label: string;
  value: string;
  role: FieldRole;
};

export type WorkflowDisplay = {
  title: string;
  amount: string | null;
  currency: string | null;
  fields: DisplayField[]; // pole pro detail (bez skrytých)
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

// Načte konfiguraci typu dokumentu pro organizaci workflowu a sestaví,
// co se má zobrazit. Bez konfigurace fallbackne na „ukaž všechna pole".
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
        include: { fields: { orderBy: { order: "asc" } } },
      })
    : null;

  let title = workflow.recordId
    ? `${workflow.documentType} · ${workflow.recordId}`
    : workflow.documentType;
  let amount: string | null = null;
  let currency: string | null = null;
  const fields: DisplayField[] = [];

  if (config && config.fields.length > 0) {
    for (const f of config.fields) {
      const value = asText(values[f.jsonKey]);
      if (f.role === "TITLE" && value) title = value;
      else if (f.role === "AMOUNT") amount = value || null;
      else if (f.role === "CURRENCY") currency = value || null;
      if (f.role !== "HIDDEN") {
        fields.push({ key: f.jsonKey, label: f.label, value, role: f.role });
      }
    }
    return {
      title,
      amount,
      currency,
      fields,
      rules: {
        requireCommentOnReject: config.requireCommentOnReject,
        requireCommentOnApprove: config.requireCommentOnApprove,
        amountThreshold: config.amountThreshold
          ? Number(config.amountThreshold)
          : null,
        thresholdAction: config.thresholdAction,
      },
    };
  }

  // Fallback bez konfigurace – všechna pole jako detail.
  for (const [k, v] of Object.entries(values)) {
    fields.push({ key: k, label: k, value: asText(v), role: "DETAIL" });
  }
  return { title, amount, currency, fields, rules: DEFAULT_RULES };
}

// Parsování částky z hodnoty (povolí čárku i tečku).
export function parseAmount(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
