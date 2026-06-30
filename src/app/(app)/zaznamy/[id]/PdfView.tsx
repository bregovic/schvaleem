"use client";

import { useEffect, useRef, useState } from "react";

// Vykreslí PDF na canvas přes pdf.js. Funguje i tam, kde mobilní prohlížeč
// (typicky Android Chrome) PDF v <iframe> vůbec nezobrazí. Worker bereme
// z jsDelivr ve verzi odpovídající nainstalovanému pdfjs-dist.
export function PdfView({
  url,
  scale = 1,
  firstPageOnly = false,
  className,
}: {
  url: string;
  scale?: number;
  firstPageOnly?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [doc, setDoc] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Načtení dokumentu (jednou na URL).
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let d: any = null;
    setFailed(false);
    setLoading(true);
    setDoc(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        d = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (cancelled) {
          d.destroy();
          return;
        }
        setDoc(d);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        d?.destroy();
      } catch {}
    };
  }, [url]);

  // Vykreslení stránek (znovu při změně měřítka).
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const host = hostRef.current;
      if (!host) return;
      setLoading(true);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const baseWidth = host.clientWidth || 320;
      const count = firstPageOnly ? 1 : doc.numPages;
      const canvases: HTMLCanvasElement[] = [];
      try {
        for (let n = 1; n <= count; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const unit = page.getViewport({ scale: 1 });
          const fit = (baseWidth / unit.width) * scale;
          const viewport = page.getViewport({ scale: fit * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 8px";
          canvas.style.maxWidth = "100%";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        if (cancelled) return;
        host.replaceChildren(...canvases);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, scale, firstPageOnly]);

  return (
    <div className={className}>
      <div ref={hostRef} />
      {loading && !failed && <p className="py-6 text-center text-sm text-muted">…</p>}
      {failed && (
        <p className="py-6 text-center text-sm text-muted">
          PDF se nepodařilo vykreslit – použij „Otevřít".
        </p>
      )}
    </div>
  );
}
