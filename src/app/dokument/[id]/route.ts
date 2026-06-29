import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Náhled PDF v prohlížeči pro přihlášené uživatele (binární stream).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return new NextResponse("Nenalezeno", { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.content), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
    },
  });
}
