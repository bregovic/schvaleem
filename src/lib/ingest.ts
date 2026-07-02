import "server-only";
import { prisma } from "@/lib/prisma";
import { parseErpDate, normalizeDataArea } from "@/lib/erp";
import { decodePdf } from "@/lib/pdf";
import { documentId } from "@/lib/ids";
import type { z } from "zod";
import type { ingestWorkitemSchema } from "@/lib/validation";

export type IngestInput = z.infer<typeof ingestWorkitemSchema>;

export type IngestResult = {
  workflowId: string;
  workitemId: string;
  duplicate: boolean;
};

// Společná logika příjmu workitemu – používá ji API i ruční import.
export async function ingestWorkitem(v: IngestInput): Promise<IngestResult> {
  const dataAreaCode = normalizeDataArea(v.dataArea);

  // DataArea evidujeme (pro wizard) – vytvoříme, pokud ji ještě neznáme.
  const dataArea = await prisma.dataArea.upsert({
    where: { code: dataAreaCode },
    update: {},
    create: { code: dataAreaCode },
  });

  const wfMeta = {
    documentType: v.documentType,
    recordId: v.recordId ?? null,
    values: v.values as object,
    organizationId: dataArea.organizationId,
    documentTypeName: v.documentTypeName ?? null,
    label: v.documentLabel ?? null,
    originator: v.originator ?? null,
    originatorName: v.originatorName ?? null,
    trackingStatus: v.trackingStatus ?? null,
    erpCreatedAt: parseErpDate(v.createdDateTime),
    // undefined = při re-importu bez historie nepřepisovat stávající
    history: v.history ?? undefined,
  };

  const workflow = await prisma.workflow.upsert({
    where: {
      erpWorkflowId_dataAreaCode: { erpWorkflowId: v.workflowId, dataAreaCode },
    },
    update: wfMeta,
    create: { erpWorkflowId: v.workflowId, dataAreaCode, ...wfMeta },
  });

  // PDF dokumenty poslané rovnou v JSONu – navázat na workflow (dedup dle názvu).
  if (v.documents && v.documents.length > 0) {
    const existingDocs = await prisma.document.findMany({
      where: { workflowId: workflow.id },
      select: { filename: true },
    });
    const have = new Set(existingDocs.map((d) => d.filename));
    for (const doc of v.documents) {
      if (have.has(doc.filename)) continue;
      const pdf = decodePdf(doc.contentBase64);
      if (!pdf.ok) continue; // neplatné PDF přeskočíme, workitem tím neshodíme
      await prisma.document.create({
        data: {
          id: documentId(),
          filename: doc.filename,
          size: pdf.size,
          content: pdf.bytes,
          workflowId: workflow.id,
        },
      });
      have.add(doc.filename);
    }
  }

  const wiMeta = {
    workflowId: workflow.id,
    dataAreaCode,
    assigneeErpUserId: v.assigneeUserId,
    assigneeName: v.assigneeName ?? null,
    subject: v.subject ?? null,
    description: v.description ?? null,
    dueAt: parseErpDate(v.dueDateTime),
    erpStatus: v.workitemStatus ?? null,
  };

  const existing = await prisma.workitem.findUnique({
    where: { erpWorkitemId: v.workitemId },
  });

  if (existing) {
    await prisma.workitem.update({ where: { erpWorkitemId: v.workitemId }, data: wiMeta });
    return { workflowId: workflow.id, workitemId: existing.id, duplicate: true };
  }

  const workitem = await prisma.workitem.create({
    data: { erpWorkitemId: v.workitemId, ...wiMeta },
  });

  // Nový doklad → upozornit řešitele push notifikací (badge i při zavřené appce).
  // Chyba pushe nesmí shodit příjem workitemu.
  try {
    const { notifyAssignee } = await import("@/lib/push");
    await notifyAssignee(v.assigneeUserId);
  } catch {
    /* ignore */
  }

  return { workflowId: workflow.id, workitemId: workitem.id, duplicate: false };
}
