"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ingestWorkitemSchema } from "@/lib/validation";
import { ingestWorkitem } from "@/lib/ingest";
import type { FieldRole, ActionKind, ThresholdAction, CheckType } from "@/generated/prisma/client";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Jen administrátor.");
  return user;
}

// --- Organizace ---

export async function createOrganization(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Název organizace je povinný.");
  await prisma.organization.create({ data: { name } });
  revalidatePath("/sprava/organizace");
}

// Wizard: přiřazení vybraných dataAreas pod organizaci (multiselect).
export async function assignDataAreas(formData: FormData): Promise<void> {
  await requireAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const ids = formData.getAll("dataAreaIds").map(String).filter(Boolean);
  if (!organizationId || ids.length === 0) return;

  const areas = await prisma.dataArea.findMany({ where: { id: { in: ids } } });
  await prisma.dataArea.updateMany({
    where: { id: { in: ids } },
    data: { organizationId },
  });
  // Doplň organizaci i na již přijaté workflow těchto dataArea.
  await prisma.workflow.updateMany({
    where: { dataAreaCode: { in: areas.map((a) => a.code) } },
    data: { organizationId },
  });
  revalidatePath("/sprava/organizace");
  revalidatePath("/sprava/konfigurace");
}

// Ruční přidání / úprava dataArea (kód firmy z ERP = ContextCompanyId).
export async function createDataArea(formData: FormData): Promise<void> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  const organizationId = String(formData.get("organizationId") ?? "").trim() || null;
  if (!code) throw new Error("Kód dataArea je povinný.");
  await prisma.dataArea.upsert({
    where: { code },
    update: { name, organizationId },
    create: { code, name, organizationId },
  });
  revalidatePath("/sprava/organizace");
}

export async function unassignDataArea(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const area = await prisma.dataArea.findUnique({ where: { id } });
  await prisma.dataArea.update({ where: { id }, data: { organizationId: null } });
  if (area) {
    await prisma.workflow.updateMany({
      where: { dataAreaCode: area.code },
      data: { organizationId: null },
    });
  }
  revalidatePath("/sprava/organizace");
}

// --- Konfigurace typu dokumentu ---

export async function upsertDocTypeConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const documentType = String(formData.get("documentType") ?? "").trim();
  if (!organizationId || !documentType) throw new Error("Organizace a typ dokumentu jsou povinné.");

  const name = String(formData.get("name") ?? "").trim() || null;
  const requireCommentOnReject = formData.get("requireCommentOnReject") === "on";
  const requireCommentOnApprove = formData.get("requireCommentOnApprove") === "on";
  const thresholdRaw = String(formData.get("amountThreshold") ?? "").trim();
  const amountThreshold = thresholdRaw ? thresholdRaw.replace(",", ".") : null;
  const thresholdAction = (String(formData.get("thresholdAction") ?? "NONE") as ThresholdAction);

  await prisma.documentTypeConfig.upsert({
    where: { organizationId_documentType: { organizationId, documentType } },
    update: { name, requireCommentOnReject, requireCommentOnApprove, amountThreshold, thresholdAction },
    create: {
      organizationId,
      documentType,
      name,
      requireCommentOnReject,
      requireCommentOnApprove,
      amountThreshold,
      thresholdAction,
    },
  });
  revalidatePath("/sprava/konfigurace");
}

export async function deleteDocTypeConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.documentTypeConfig.delete({ where: { id } });
  revalidatePath("/sprava/konfigurace");
}

export async function addField(formData: FormData): Promise<void> {
  await requireAdmin();
  const configId = String(formData.get("configId") ?? "");
  const jsonKey = String(formData.get("jsonKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || jsonKey;
  const role = String(formData.get("role") ?? "DETAIL") as FieldRole;
  const preview = formData.get("preview") === "on";
  const order = Number(formData.get("order") ?? 0) || 0;
  if (!configId || !jsonKey) return;
  await prisma.fieldConfig.create({ data: { configId, jsonKey, label, role, preview, order } });
  revalidatePath("/sprava/konfigurace");
}

export async function deleteField(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.fieldConfig.delete({ where: { id } });
  revalidatePath("/sprava/konfigurace");
}

export async function addAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const configId = String(formData.get("configId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || code;
  const kind = String(formData.get("kind") ?? "OTHER") as ActionKind;
  if (!configId || !code) return;
  await prisma.actionConfig.create({ data: { configId, code, label, kind } });
  revalidatePath("/sprava/konfigurace");
}

export async function deleteAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.actionConfig.delete({ where: { id } });
  revalidatePath("/sprava/konfigurace");
}

// --- Automatické kontroly ---

export async function addCheck(formData: FormData): Promise<void> {
  await requireAdmin();
  const configId = String(formData.get("configId") ?? "");
  const type = String(formData.get("type") ?? "") as CheckType;
  const jsonKey = String(formData.get("jsonKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || jsonKey;
  if (!configId || !type || !jsonKey) return;
  await prisma.checkConfig.create({ data: { configId, type, jsonKey, label } });
  revalidatePath("/sprava/konfigurace");
}

export async function deleteCheck(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.checkConfig.delete({ where: { id } });
  revalidatePath("/sprava/konfigurace");
}

// --- Ruční import workitemů z JSON (bez API) ---

export type ImportState = {
  error?: string;
  ok?: boolean;
  created?: number;
  updated?: number;
  failed?: number;
  docs?: number;
  messages?: string[];
};

// Z položky vytáhne odkazované názvy PDF z `documents` ("x.pdf" i {filename}).
function referencedPdfNames(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];
  const docs = (item as { documents?: unknown }).documents;
  if (!Array.isArray(docs)) return [];
  return docs
    .map((d) => (typeof d === "string" ? d : (d as { filename?: string })?.filename))
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

export async function importWorkitems(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();
  const raw = String(formData.get("json") ?? "").trim();
  if (!raw) return { error: "Vlož JSON (objekt nebo pole workitemů)." };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // Záchrana: odstraň reálné řídicí znaky (CR/LF/TAB uvnitř řetězců z ERP),
    // které dělají JSON nevalidním. Mimo řetězce jsou to jen mezery, takže
    // strukturu to neporuší.
    try {
      const sanitized = Array.from(raw)
        .map((ch) => (ch.charCodeAt(0) < 32 ? " " : ch))
        .join("");
      data = JSON.parse(sanitized);
    } catch {
      return { error: "Neplatný JSON." };
    }
  }

  // Nahraná PDF -> mapa název(lowercase) => Base64
  const pdfMap = new Map<string, { filename: string; contentBase64: string }>();
  for (const entry of formData.getAll("pdfs")) {
    if (typeof entry === "string" || entry.size === 0) continue;
    const base64 = Buffer.from(await entry.arrayBuffer()).toString("base64");
    pdfMap.set(entry.name.toLowerCase(), { filename: entry.name, contentBase64: base64 });
  }
  const allPdfs = [...pdfMap.values()];

  const arr = Array.isArray(data) ? data : [data];
  let created = 0;
  let updated = 0;
  let failed = 0;
  let docs = 0;
  const messages: string[] = [];

  for (let i = 0; i < arr.length; i++) {
    // `documents` ze vstupu řešíme tady (vstupní JSON nese jen názvy), proto ho
    // před validací odstraníme a doplníme vlastní pole s Base64 z nahraných PDF.
    const wanted = referencedPdfNames(arr[i]);
    const item =
      arr[i] && typeof arr[i] === "object"
        ? { ...(arr[i] as Record<string, unknown>), documents: undefined }
        : arr[i];

    const p = ingestWorkitemSchema.safeParse(item);
    if (!p.success) {
      failed++;
      messages.push(`#${i + 1}: ${p.error.issues.map((x) => x.message).join(", ")}`);
      continue;
    }

    // Navázat PDF: podle názvů z JSONu, jinak (žádné názvy) všechna nahraná.
    let attach: { filename: string; contentBase64: string }[];
    if (wanted.length > 0) {
      attach = [];
      for (const name of wanted) {
        const hit = pdfMap.get(name.toLowerCase());
        if (hit) attach.push(hit);
        else messages.push(`#${i + 1}: PDF "${name}" nebylo nahráno.`);
      }
    } else {
      attach = allPdfs;
    }

    try {
      const r = await ingestWorkitem({ ...p.data, documents: attach });
      docs += attach.length;
      if (r.duplicate) updated++;
      else created++;
    } catch (e) {
      failed++;
      messages.push(`#${i + 1}: ${e instanceof Error ? e.message : "chyba"}`);
    }
  }

  revalidatePath("/zaznamy");
  return { ok: true, created, updated, failed, docs, messages: messages.slice(0, 12) };
}
