"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

// Subject + description (instrukce z ERP) schované pod malé tlačítko.
export function Instructions({
  t,
  subject,
  description,
}: {
  t: Dict;
  subject: string | null;
  description: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!subject && !description) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:text-fg"
        aria-expanded={open}
      >
        <span className={`transition ${open ? "rotate-90" : ""}`}>▸</span>
        {t.detail.instructions}
      </button>
      {open && (
        <div className="mt-2 rounded-md bg-surface-2 p-3 text-sm">
          {subject && <p className="font-medium text-fg">{subject}</p>}
          {description && <p className="mt-1 whitespace-pre-wrap break-words text-muted">{description}</p>}
        </div>
      )}
    </div>
  );
}
