import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey, errorResponse } from "@/lib/api";

// GET /api/documents/{id} – vrací PDF zpět jako Base64 v JSON (ne binární stream).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const path = `/api/documents/${id}`;

  return withApiKey(req, path, async () => {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return errorResponse(404, "not_found", "Dokument nenalezen.");
    }

    const contentBase64 = Buffer.from(doc.content).toString("base64");
    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      contentType: doc.contentType,
      size: doc.size,
      contentBase64,
    });
  });
}
