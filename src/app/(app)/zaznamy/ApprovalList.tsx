"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { decideWorkitems, type DecideState } from "../actions";

export type ApprovalItem = {
  id: string;
  org: string;
  title: string;
  amount: string | null;
  currency: string | null;
  documentType: string;
  dataArea: string;
  createdAt: string;
};

const initial: DecideState = {};

function amountLabel(it: ApprovalItem) {
  if (!it.amount) return null;
  return `${it.amount}${it.currency ? " " + it.currency : ""}`;
}

export function ApprovalList({ items }: { items: ApprovalItem[] }) {
  const [mode, setMode] = useState<"list" | "swipe">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [state, formAction, pending] = useActionState(decideWorkitems, initial);

  // Po změně dat (po rozhodnutí) vyčisti výběr a resetuj swipe.
  const idsKey = items.map((i) => i.id).join(",");
  useEffect(() => {
    setSelected(new Set());
    setSwipeIdx(0);
  }, [idsKey]);

  const groups = useMemo(() => {
    const map = new Map<string, ApprovalItem[]>();
    for (const it of items) {
      const arr = map.get(it.org) ?? [];
      arr.push(it);
      map.set(it.org, arr);
    }
    return [...map.entries()];
  }, [items]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleGroup(groupItems: ApprovalItem[], on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      for (const it of groupItems) {
        if (on) n.add(it.id);
        else n.delete(it.id);
      }
      return n;
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200">
        Nemáš nic ke schválení. 🎉
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setMode("list")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "list" ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          Seznam
        </button>
        <button
          onClick={() => setMode("swipe")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "swipe" ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          Swipe
        </button>
        <span className="ml-auto text-sm text-slate-400">{items.length} ke schválení</span>
      </div>

      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Hotovo – rozhodnuto {state.count}.
        </p>
      )}

      {mode === "list" ? (
        <form action={formAction}>
          <div className="flex flex-col gap-5">
            {groups.map(([org, groupItems]) => {
              const allOn = groupItems.every((it) => selected.has(it.id));
              return (
                <div key={org} className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-brand">{org}</h2>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={(e) => toggleGroup(groupItems, e.target.checked)}
                      />
                      Vybrat vše
                    </label>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {groupItems.map((it) => (
                      <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(it.id)}
                          onChange={() => toggle(it.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-brand">{it.title}</p>
                          <p className="text-xs text-slate-400">
                            {it.documentType} · {it.dataArea}
                          </p>
                        </div>
                        {amountLabel(it) && (
                          <span className="whitespace-nowrap font-medium text-brand">
                            {amountLabel(it)}
                          </span>
                        )}
                        <Link
                          href={`/zaznamy/${it.id}`}
                          className="text-sm font-medium text-brand-accent hover:underline"
                        >
                          Detail
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Lišta hromadného rozhodnutí */}
          {selected.size > 0 && (
            <div className="sticky bottom-4 mt-4 flex flex-col gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Vybráno: {selected.size}
                </span>
                <input
                  name="comment"
                  placeholder="Komentář (volitelné / dle pravidel povinné)…"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
                <button
                  type="submit"
                  name="action"
                  value="APPROVE"
                  disabled={pending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  ✓ Schválit
                </button>
                <button
                  type="submit"
                  name="action"
                  value="REJECT"
                  disabled={pending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  ✕ Zamítnout
                </button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <SwipeCard item={items[swipeIdx]} index={swipeIdx} total={items.length} formAction={formAction} pending={pending} />
      )}
    </div>
  );
}

function SwipeCard({
  item,
  index,
  total,
  formAction,
  pending,
}: {
  item: ApprovalItem | undefined;
  index: number;
  total: number;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  if (!item) {
    return (
      <p className="rounded-lg bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200">
        Hotovo, žádné další. 🎉
      </p>
    );
  }
  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-xs text-slate-400">
        {index + 1} / {total}
      </p>
      <form action={formAction} className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <input type="hidden" name="ids" value={item.id} />
        <p className="text-xs text-slate-400">{item.org}</p>
        <h2 className="mt-1 text-xl font-semibold text-brand">{item.title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {item.documentType} · {item.dataArea}
        </p>
        {amountLabel(item) && (
          <p className="mt-4 text-3xl font-bold text-brand">{amountLabel(item)}</p>
        )}
        <Link
          href={`/zaznamy/${item.id}`}
          className="mt-3 inline-block text-sm font-medium text-brand-accent hover:underline"
        >
          Zobrazit detail
        </Link>
        <input
          name="comment"
          placeholder="Komentář (volitelné)…"
          className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            name="action"
            value="REJECT"
            disabled={pending}
            className="flex-1 rounded-xl bg-red-600 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            ✕ Zamítnout
          </button>
          <button
            type="submit"
            name="action"
            value="APPROVE"
            disabled={pending}
            className="flex-1 rounded-xl bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            ✓ Schválit
          </button>
        </div>
      </form>
    </div>
  );
}
