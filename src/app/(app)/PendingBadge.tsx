"use client";

import { useEffect, useState } from "react";
import { getPendingCount } from "./pending";

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

  // Odznáček přímo na ikoně nainstalované PWA (zástupce v menu / na liště).
  // Funguje, dokud appka běží (i na pozadí); po úplném zavření by to chtělo push.
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
