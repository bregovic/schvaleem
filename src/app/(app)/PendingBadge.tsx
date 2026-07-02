"use client";

import { useEffect, useState } from "react";
import { getPendingCount, savePushSubscription } from "./pending";

// base64url VAPID klíč → Uint8Array pro applicationServerKey
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Odznáček s počtem čekajících dokladů. Startuje z hodnoty vykreslené serverem
// (žádné bliknutí) a tiše se sám aktualizuje – interval + návrat do okna –,
// takže nové doklady naskočí i bez otevření/refreshe stránky.
export function PendingBadge({
  initial,
  label,
  intervalMs = 45000,
}: {
  initial: number;
  label: string;
  intervalMs?: number;
}) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const n = await getPendingCount();
        if (alive) setCount(n);
      } catch {
        // tichý neúspěch – zkusí se příště
      }
    };
    const id = setInterval(tick, intervalMs);
    const onFocus = () => tick();
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  // Přihlášení k Web Push – aby se ikona aktualizovala i při ZAVŘENÉ appce.
  // Jednorázově: vyžádá povolení, subscribuje přes VAPID a uloží odběr na server.
  useEffect(() => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return;
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return;

    let cancelled = false;
    (async () => {
      try {
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        if (perm !== "granted") return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
          });
        }
        if (cancelled) return;
        const json = sub.toJSON();
        await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
      } catch {
        // push je bonus – tichý neúspěch
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Odznáček přímo na ikoně nainstalované PWA (zástupce v menu / na liště).
  // Funguje, dokud appka běží (i na pozadí); po úplném zavření řeší push výše.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!("setAppBadge" in navigator)) return;
    if (count > 0) nav.setAppBadge?.(count).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [count]);

  if (count <= 0) return null;

  return (
    <span
      title={`${count} ${label}`}
      className="absolute -right-2 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
