"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Počet dokladů čekajících na aktuálního uživatele. Volá se i z klienta
// (polling odznáčku v navigaci), proto samostatná lehká server akce.
export async function getPendingCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user?.erpUserId) return 0;
  return prisma.workitem.count({
    where: { assigneeErpUserId: user.erpUserId, status: "PENDING" },
  });
}
