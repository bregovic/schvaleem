import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";
import { documentId } from "@/lib/ids";
import { createDocumentSchema } from "@/lib/validation";

const PATH = "/api/documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (zadání kap. 6)

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

    let buffer: Buffer;
    try {
      buffer = Buffer.from(contentBase64, "base64");
    } catch {
      return errorResponse(400, "bad_base64", "contentBase64 není platný Base64.");
    }

    if (buffer.length === 0) {
      return errorResponse(400, "empty_file", "Dekódovaný soubor je prázdný.");
    }
    if (buffer.length > MAX_BYTES) {
      return errorResponse(
        413,
        "payload_too_large",
        `Soubor je příliš velký (max ${MAX_BYTES / 1024 / 1024} MB).`,
      );
    }

    // Doporučená validace, že jde skutečně o PDF (hlavička %PDF).
    const isPdf = buffer.subarray(0, 4).toString("latin1") === "%PDF";
    if (!isPdf) {
      return errorResponse(400, "not_pdf", "Obsah není platné PDF (chybí hlavička %PDF).");
    }

    // Volitelná vazba na workflow (podle erpWorkflowId + dataArea).
    let linkedWorkflowId: string | null = null;
    if (workflowId && dataArea) {
      const wf = await prisma.workflow.findUnique({
        where: {
          erpWorkflowId_dataAreaCode: {
            erpWorkflowId: workflowId,
            dataAreaCode: dataArea,
          },
        },
      });
      linkedWorkflowId = wf ? wf.id : null;
    }

    const doc = await prisma.document.create({
      data: {
        id: documentId(),
        filename,
        size: buffer.length,
        content: new Uint8Array(buffer),
        workflowId: linkedWorkflowId,
      },
    });

    return NextResponse.json(
      { id: doc.id, filename: doc.filename, status: "stored" },
      { status: 201 },
    );
  });
}
