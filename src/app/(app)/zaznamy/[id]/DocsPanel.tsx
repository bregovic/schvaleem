"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, type UploadState } from "./doc-actions";
import { PdfView } from "./PdfView";
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
  const [scale, setScale] = useState(1);
  const [state, formAction, pending] = useActionState(uploadDocument, initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function openFull(d: Doc) {
    setScale(1);
    setFull(d);
  }

  // Po úspěšném nahrání vyčisti formulář a načti detail (objeví se nová příloha).
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  // Fullscreen přidá stav do historie; zavření (✕/Escape/Zpět) jde VŽDY přes
  // history.back() → popstate náhled zavře a přidaný stav se uklidí. Cleanup
  // nikdy nevolá back() (jinak by při navigaci pryč „odskočil" na předchozí
  // stránku). Případný zbylý stav posbírá prohlížeč přirozeně.
  useEffect(() => {
    if (!full) return;
    window.history.pushState({ schvaleemPdf: true }, "");
    const onPop = () => setFull(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.history.back();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const closeFull = () => window.history.back();

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
              {/* Malý náhled (1. strana) – klik otevře fullscreen. */}
              <button
                type="button"
                onClick={() => openFull(d)}
                title={t.detail.fullscreen}
                className="block w-full cursor-zoom-in text-left"
              >
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-accent">
                  <span aria-hidden>⛶</span>
                  <span className="truncate text-fg">{d.filename}</span>
                </span>
                <div className="pointer-events-none max-h-56 overflow-hidden rounded-md border border-line bg-surface-2 p-1">
                  <PdfView url={`/dokument/${d.id}`} firstPageOnly />
                </div>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-white">
            <span className="min-w-0 truncate text-sm font-medium">{full.filename}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, +(s / 1.25).toFixed(3)))}
                aria-label="−"
                className="rounded bg-white/15 px-2.5 py-1 text-base leading-none hover:bg-white/25"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(6, +(s * 1.25).toFixed(3)))}
                aria-label="+"
                className="rounded bg-white/15 px-2.5 py-1 text-base leading-none hover:bg-white/25"
              >
                +
              </button>
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
                onClick={closeFull}
                className="text-sm font-medium hover:underline"
              >
                ✕ {t.detail.close}
              </button>
            </div>
          </div>
          {/* Scroll = posun; tlačítka +/− = zoom; dvojklik/dvojťuk = zavřít. */}
          <div
            className="flex-1 overflow-auto overscroll-contain bg-neutral-800 p-2"
            style={{ touchAction: "pan-x pan-y" }}
            onDoubleClick={closeFull}
          >
            <PdfView url={`/dokument/${full.id}`} scale={scale} className="mx-auto w-full max-w-3xl" />
          </div>
        </div>
      )}
    </section>
  );
}
