"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { FieldRole, ActionKind, ThresholdAction } from "@/generated/prisma/client";

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
  const order = Number(formData.get("order") ?? 0) || 0;
  if (!configId || !jsonKey) return;
  await prisma.fieldConfig.create({ data: { configId, jsonKey, label, role, order } });
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
