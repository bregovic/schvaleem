import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";
import { documentId } from "@/lib/ids";
import { createDocumentSchema } from "@/lib/validation";
import { decodePdf } from "@/lib/pdf";
import { normalizeDataArea } from "@/lib/erp";

const PATH = "/api/documents";

// POST /api/documents – PDF zakódované v Base64 uvnitř JSON (žádný multipart).
export async function POST(req: Request) {
  return withApiKey(req, PATH, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "bad_request", "Tělo požadavku není platný JSON.");
    }

    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join(" "),
      );
    }

    const { filename, workflowId, dataArea, contentBase64 } = parsed.data;

    const pdf = decodePdf(contentBase64);
    if (!pdf.ok) {
      return errorResponse(pdf.code === "payload_too_large" ? 413 : 400, pdf.code, pdf.message);
    }

    // Volitelná vazba na workflow (podle erpWorkflowId + dataArea, case-insensitive).
    let linkedWorkflowId: string | null = null;
    if (workflowId && dataArea) {
      const wf = await prisma.workflow.findUnique({
        where: {
          erpWorkflowId_dataAreaCode: {
            erpWorkflowId: workflowId,
            dataAreaCode: normalizeDataArea(dataArea),
          },
        },
      });
      linkedWorkflowId = wf ? wf.id : null;
    }

    const doc = await prisma.document.create({
      data: {
        id: documentId(),
        filename,
        size: pdf.size,
        content: pdf.bytes,
        workflowId: linkedWorkflowId,
      },
    });

    return NextResponse.json(
      { id: doc.id, filename: doc.filename, status: "stored" },
      { status: 201 },
    );
  });
}
