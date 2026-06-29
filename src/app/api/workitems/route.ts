import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";
import { ingestWorkitemSchema } from "@/lib/validation";
import { ingestWorkitem } from "@/lib/ingest";

const PATH = "/api/workitems";

// POST /api/workitems – příjem jednoho aktivního workitemu z ERP.
// Obsah (workflow) se dedupuje podle erpWorkflowId + dataArea.
export async function POST(req: Request) {
  return withApiKey(req, PATH, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "bad_request", "Tělo požadavku není platný JSON.");
    }

    const parsed = ingestWorkitemSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join(" "),
      );
    }

    const res = await ingestWorkitem(parsed.data);
    return NextResponse.json(
      {
        workflowId: res.workflowId,
        workitemId: res.workitemId,
        status: "stored",
        ...(res.duplicate ? { duplicate: true } : {}),
      },
      { status: res.duplicate ? 200 : 201 },
    );
  });
}

// GET /api/workitems?status=decided&dataArea=CZ01 – ERP si vyzvedne rozhodnutí.
// Vrací POVINNĚ obálku { records: [...] } kvůli parsování v AX.
export async function GET(req: Request) {
  return withApiKey(req, PATH, async () => {
    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") ?? "decided").toLowerCase();
    const dataArea = url.searchParams.get("dataArea") ?? undefined;

    const decidedStatuses = ["APPROVED", "REJECTED", "COMPLETED_BY_SYSTEM"] as const;
    const where =
      statusParam === "decided"
        ? { status: { in: [...decidedStatuses] }, deliveredToErpAt: null }
        : statusParam === "pending"
          ? { status: "PENDING" as const }
          : { status: { in: [...decidedStatuses] }, deliveredToErpAt: null };

    const items = await prisma.workitem.findMany({
      where: { ...where, ...(dataArea ? { dataAreaCode: dataArea } : {}) },
      include: { workflow: true, decidedBy: true },
      orderBy: { decidedAt: "asc" },
      take: 500,
    });

    return NextResponse.json({
      records: items.map((w) => ({
        workitemId: w.erpWorkitemId,
        workflowId: w.workflow.erpWorkflowId,
        dataArea: w.dataAreaCode,
        documentType: w.workflow.documentType,
        recordId: w.workflow.recordId,
        assigneeUserId: w.assigneeErpUserId,
        status: w.status,
        action: w.action,
        comment: w.comment,
        decidedByUserId: w.decidedBy?.erpUserId ?? null,
        decidedAt: w.decidedAt,
      })),
    });
  });
}
