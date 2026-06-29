"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Zavře detail klávesou Escape (zpět na seznam).
export function EscClose() {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/zaznamy");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
