import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured: boolean | null = null;

// Nastaví VAPID z env (jednou). Vrací false, když klíče nejsou – push se pak
// jen přeskočí (appka funguje dál, jen bez notifikací).
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  count?: number;
  title?: string;
  body?: string;
};

/** Pošle push všem zařízením uživatele; neplatné odběry (410/404) smaže. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          // odběr zanikl (odinstalováno, odhlášeno) – uklidíme
          await prisma.pushSubscription
            .delete({ where: { endpoint: s.endpoint } })
            .catch(() => {});
        }
      }
    }),
  );
}

/** Upozorní řešitele (podle ERP userId) na nový/aktuální stav fronty. */
export async function notifyAssignee(assigneeErpUserId: string): Promise<void> {
  if (!assigneeErpUserId) return;
  if (!ensureConfigured()) return;

  const user = await prisma.user.findUnique({
    where: { erpUserId: assigneeErpUserId },
    select: { id: true },
  });
  if (!user) return;

  const count = await prisma.workitem.count({
    where: { assigneeErpUserId, status: "PENDING" },
  });

  await sendPushToUser(user.id, {
    count,
    title: "Nový doklad ke schválení",
    body:
      count === 1
        ? "Čeká na tebe 1 doklad."
        : `Čeká na tebe ${count} dokladů.`,
  });
}
