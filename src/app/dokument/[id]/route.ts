import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Náhled PDF v prohlížeči (binární stream). Přístup má administrátor nebo
// řešitel některého workitemu daného dokladu – ne každý přihlášený (IDOR).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { workflow: { select: { workitems: { select: { assigneeErpUserId: true } } } } },
  });
  if (!doc) {
    return new NextResponse("Nenalezeno", { status: 404 });
  }

  // Ukázková PDF v testovacím režimu jsou náhodné doklady → kontrolu vlastnictví
  // přeskoč jen tehdy (v produkci proměnná není nastavená).
  const demo = process.env.SCHVALEEM_DEMO_PDF === "1";
  const isOwner =
    !!user.erpUserId &&
    (doc.workflow?.workitems.some((w) => w.assigneeErpUserId === user.erpUserId) ?? false);
  if (!demo && user.role !== "ADMIN" && !isOwner) {
    return new NextResponse("Nenalezeno", { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.content), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
    },
  });
}
