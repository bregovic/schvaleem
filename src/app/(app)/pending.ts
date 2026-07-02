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

// Uloží (upsertne) Web Push odběr pro přihlášeného uživatele.
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  });
  return { ok: true };
}

// Zruší odběr (při odhlášení notifikací / odinstalování).
export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  await prisma.pushSubscription
    .deleteMany({ where: { endpoint } })
    .catch(() => {});
}
