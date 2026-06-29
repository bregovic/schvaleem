import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";
import { completeWorkflowSchema } from "@/lib/validation";

// POST /api/workflows/complete – workflow bylo dokončeno v ERP bez uživatele.
// Smaže celý workflow včetně všech workitemů a dokumentů. Úspěch = 204.
export async function POST(req: Request) {
  const PATH = "/api/workflows/complete";
  return withApiKey(req, PATH, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "bad_request", "Tělo požadavku není platný JSON.");
    }

    const parsed = completeWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join(" "),
      );
    }

    const workflow = await prisma.workflow.findUnique({
      where: {
        erpWorkflowId_dataAreaCode: {
          erpWorkflowId: parsed.data.workflowId,
          dataAreaCode: parsed.data.dataArea,
        },
      },
    });
    if (!workflow) {
      return errorResponse(404, "not_found", "Workflow nenalezeno.");
    }

    // Document.workflowId má onDelete: SetNull, proto dokumenty smažeme zvlášť.
    await prisma.document.deleteMany({ where: { workflowId: workflow.id } });
    await prisma.workflow.delete({ where: { id: workflow.id } });

    return new NextResponse(null, { status: 204 });
  });
}
