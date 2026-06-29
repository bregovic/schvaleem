"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";

type PwaPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function InstallApp({ t }: { t: Dict }) {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const w = window as unknown as { __pwaPrompt?: PwaPrompt };
    if (w.__pwaPrompt) setAvailable(true);
    const onAvail = () => setAvailable(true);
    const onInstalled = () => {
      setInstalled(true);
      setAvailable(false);
    };
    window.addEventListener("pwa-available", onAvail);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("pwa-available", onAvail);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const w = window as unknown as { __pwaPrompt?: PwaPrompt };
    const p = w.__pwaPrompt;
    if (!p) return;
    await p.prompt();
    await p.userChoice;
    w.__pwaPrompt = undefined;
    setAvailable(false);
  }

  if (installed) {
    return <p className="text-sm text-muted">✓ {t.account.appInstalled}</p>;
  }
  if (available) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        {t.account.installApp}
      </button>
    );
  }
  return <p className="text-xs text-muted">{t.account.installHint}</p>;
}
