"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { decodePdf } from "@/lib/pdf";
import { documentId } from "@/lib/ids";

export type UploadState = { error?: string; ok?: boolean; filename?: string };

// Ruční nahrání PDF přílohy k dokladu přímo z detailu. Smí ji nahrát řešitel
// workitemu nebo administrátor (stejné oprávnění jako pro zobrazení detailu).
export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Nepřihlášeno." };

  const workitemId = String(formData.get("workitemId") ?? "");
  const file = formData.get("file");

  const workitem = await prisma.workitem.findUnique({
    where: { id: workitemId },
    select: { assigneeErpUserId: true, workflowId: true },
  });
  if (!workitem) return { error: "Workitem nenalezen." };

  const isOwner = !!user.erpUserId && workitem.assigneeErpUserId === user.erpUserId;
  if (!isOwner && user.role !== "ADMIN") return { error: "Nemáš oprávnění." };

  if (!(file instanceof File) || file.size === 0) return { error: "Vyber PDF soubor." };

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const pdf = decodePdf(base64);
  if (!pdf.ok) return { error: pdf.message };

  // Dedup podle názvu – stejnou přílohu nenahrávat dvakrát.
  const exists = await prisma.document.findFirst({
    where: { workflowId: workitem.workflowId, filename: file.name },
    select: { id: true },
  });
  if (exists) return { error: `Příloha „${file.name}" už je nahraná.` };

  await prisma.document.create({
    data: {
      id: documentId(),
      filename: file.name,
      size: pdf.size,
      content: pdf.bytes,
      workflowId: workitem.workflowId,
    },
  });

  revalidatePath(`/zaznamy/${workitemId}`);
  return { ok: true, filename: file.name };
}
