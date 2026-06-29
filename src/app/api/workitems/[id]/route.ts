import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";
import { patchWorkitemSchema } from "@/lib/validation";

// PATCH /api/workitems/{erpWorkitemId}
//  - { "acknowledged": true } – ERP převzalo rozhodnutí -> workitem smažeme.
//  - { "complete": true }     – workflow dokončen v ERP bez uživatele -> smažeme.
// Když workflow zůstane bez workitemů, smaže se i workflow (a jeho PDF).
// Úspěch = 204 No Content (kvůli AX).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const path = `/api/workitems/${id}`;

  return withApiKey(req, path, async () => {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // prázdné tělo bereme jako acknowledged
    }
    const parsed = patchWorkitemSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "validation_error", "Neplatné tělo požadavku.");
    }

    const workitem = await prisma.workitem.findUnique({
      where: { erpWorkitemId: id },
    });
    if (!workitem) {
      return errorResponse(404, "not_found", "Workitem nenalezen.");
    }

    const workflowId = workitem.workflowId;
    await prisma.workitem.delete({ where: { id: workitem.id } });

    // Pokud workflow nemá další workitemy, ukliď i jeho obsah a dokumenty.
    const remaining = await prisma.workitem.count({ where: { workflowId } });
    if (remaining === 0) {
      await prisma.document.deleteMany({ where: { workflowId } });
      await prisma.workflow.delete({ where: { id: workflowId } }).catch(() => {});
    }

    return new NextResponse(null, { status: 204 });
  });
}
