"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { importWorkitems, type ImportState } from "../config-actions";

const initial: ImportState = {};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importWorkitems, initial);
  const [text, setText] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="text-sm text-slate-600"
      />
      <textarea
        name="json"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder='[ { "workflowId": "...", "workitemId": "...", "dataArea": "BI", "documentType": "1425", "assigneeUserId": "jnovak", "values": { ... } } ]'
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-accent"
      />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Importuji…" : "Importovat"}
        </button>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Hotovo – vytvořeno {state.created}, aktualizováno {state.updated}, chyb {state.failed}.
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
