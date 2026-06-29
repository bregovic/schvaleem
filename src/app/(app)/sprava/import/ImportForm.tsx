"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { importWorkitems, type ImportState } from "../config-actions";

const initial: ImportState = {};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importWorkitems, initial);
  const [text, setText] = useState("");
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [pdfNames, setPdfNames] = useState<string[]>([]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const content = await f.text();
    setText(content);
    try {
      const parsed = JSON.parse(content);
      const count = Array.isArray(parsed) ? parsed.length : 1;
      setFileInfo(`${f.name} – ${count} workitem(ů) načteno`);
    } catch {
      setFileInfo(`${f.name} – ⚠️ není platný JSON`);
    }
  }

  function onPdfs(e: ChangeEvent<HTMLInputElement>) {
    setPdfNames(Array.from(e.target.files ?? []).map((f) => f.name));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-line px-4 py-6 text-center hover:border-brand-accent">
        <span className="text-sm font-medium text-brand">Vybrat soubor JSON…</span>
        <span className="text-xs text-muted">
          soubor z jobu (schvaleem_workitems_…json) – načte se rovnou
        </span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="hidden"
        />
      </label>
      {fileInfo && <p className="text-xs text-muted">📄 {fileInfo}</p>}
      <p className="text-xs text-muted">…nebo vlož/uprav JSON ručně:</p>
      <textarea
        name="json"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder='[ { "workflowId": "...", "workitemId": "...", "dataArea": "BI", "documentType": "1425", "assigneeUserId": "jnovak", "values": { ... } } ]'
        className="w-full rounded-md border border-line px-3 py-2 font-mono text-xs outline-none focus:border-brand-accent"
      />

      <div className="rounded-md border border-line p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-brand">
          <span className="rounded-md bg-surface-2 px-3 py-1.5 hover:bg-line">
            📎 Přidat PDF…
          </span>
          <input
            type="file"
            name="pdfs"
            accept="application/pdf,.pdf"
            multiple
            onChange={onPdfs}
            className="hidden"
          />
        </label>
        <p className="mt-1 text-xs text-muted">
          PDF se navážou na doklad. Když do JSONu workitemu doplníš{" "}
          <code className="rounded bg-surface-2 px-1">{`"documents": ["nazev.pdf"]`}</code>, naváže se
          podle názvu; jinak se ke každému dokladu připnou všechna nahraná PDF.
        </p>
        {pdfNames.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-muted">
            {pdfNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Importuji…" : "Importovat"}
        </button>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Hotovo – vytvořeno {state.created}, aktualizováno {state.updated}, chyb {state.failed}
          {typeof state.docs === "number" ? `, PDF navázáno ${state.docs}` : ""}.
          {state.messages && state.messages.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-700">
              {state.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
