"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, type UploadState } from "./doc-actions";
import type { Dict } from "@/lib/i18n";

type Doc = { id: string; filename: string };
const initial: UploadState = {};

export function DocsPanel({
  workitemId,
  docs,
  demoNote,
  canUpload,
  t,
}: {
  workitemId: string;
  docs: Doc[];
  demoNote: boolean;
  canUpload: boolean;
  t: Dict;
}) {
  const [full, setFull] = useState<Doc | null>(null);
  const [state, formAction, pending] = useActionState(uploadDocument, initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Po úspěšném nahrání vyčisti formulář a načti detail (objeví se nová příloha).
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  // Escape zavře fullscreen náhled.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  // Tlačítko Zpět (Android/prohlížeč) zavře nejdřív fullscreen, ne celou stránku.
  // Při otevření přidáme stav do historie; Zpět ho sebere → zavřeme náhled.
  useEffect(() => {
    if (!full) return;
    let popped = false;
    window.history.pushState({ schvaleemPdf: true }, "");
    const onPop = () => {
      popped = true;
      setFull(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped) window.history.back(); // zavřeno přes ✕ → ubereme přidaný stav
    };
  }, [full]);

  return (
    <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
      <h2 className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
        <span>
          {t.detail.documents} ({docs.length})
        </span>
        {demoNote && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-normal text-amber-300">
            {t.detail.demoNote}
          </span>
        )}
      </h2>

      {docs.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{t.detail.noDocs}</p>
      ) : (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="p-3">
              {/* Malý náhled – klik otevře fullscreen (iframe nechytá kliknutí). */}
              <button
                type="button"
                onClick={() => setFull(d)}
                title={t.detail.fullscreen}
                className="block w-full cursor-zoom-in text-left"
              >
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-accent">
                  <span aria-hidden>⛶</span>
                  <span className="truncate text-fg">{d.filename}</span>
                </span>
                <iframe
                  src={`/dokument/${d.id}#view=FitH&toolbar=0`}
                  title={d.filename}
                  className="pointer-events-none h-40 w-full rounded-md border border-line bg-surface-2 sm:h-56"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-2 border-t border-line p-4"
        >
          <input type="hidden" name="workitemId" value={workitemId} />
          <label className="text-sm font-medium text-muted">{t.detail.addAttachment}</label>
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-fg hover:file:bg-line"
          />
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {state.ok && <p className="text-sm text-green-400">{t.detail.uploaded}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? t.detail.uploading : t.detail.uploadBtn}
          </button>
        </form>
      )}

      {full && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3 sm:p-6"
          onClick={() => setFull(null)}
        >
          <div
            className="mb-2 flex items-center justify-between gap-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate text-sm font-medium">{full.filename}</span>
            <div className="flex shrink-0 gap-4">
              <a
                href={`/dokument/${full.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent hover:underline"
              >
                {t.detail.open}
              </a>
              <button
                type="button"
                onClick={() => setFull(null)}
                className="text-sm font-medium hover:underline"
              >
                ✕ {t.detail.close}
              </button>
            </div>
          </div>
          <iframe
            src={`/dokument/${full.id}#view=FitH`}
            title={full.filename}
            className="w-full flex-1 rounded-md border border-line bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
