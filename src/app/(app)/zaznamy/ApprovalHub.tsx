"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decideWorkitems } from "../actions";
import { SwipeDeck } from "./SwipeDeck";
import { amountLabel, type ApprovalItem } from "./types";

type Action = "APPROVE" | "REJECT" | "DEFER";

function agg(items: ApprovalItem[], keyFn: (i: ApprovalItem) => [string, string]) {
  const map = new Map<string, { label: string; count: number }>();
  for (const it of items) {
    const [key, label] = keyFn(it);
    const cur = map.get(key) ?? { label, count: 0 };
    cur.count++;
    map.set(key, cur);
  }
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
}

export function ApprovalHub({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"swipe" | "list">("list");
  const [isMobile, setIsMobile] = useState(false);
  const [fType, setFType] = useState<string | null>(null);
  const [fCompany, setFCompany] = useState<string | null>(null);
  const [queue, setQueue] = useState<ApprovalItem[]>(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Swipe nabízíme jen na mobilu/dotyku; na PC je vždy seznam.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    setIsMobile(mq.matches);
    setMode(mq.matches ? "swipe" : "list");
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) => (!fType || i.documentType === fType) && (!fCompany || i.dataArea === fCompany),
      ),
    [items, fType, fCompany],
  );

  // resync fronty po změně dat / filtru
  const filteredKey = filtered.map((i) => i.id).join(",");
  useEffect(() => {
    setQueue(filtered);
    setSelected(new Set());
  }, [filteredKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const byType = useMemo(() => agg(items, (i) => [i.documentType, i.documentTypeName]), [items]);
  const byCompany = useMemo(
    () => agg(items, (i) => [i.dataArea, i.dataAreaName ?? i.dataArea]),
    [items],
  );

  async function run(ids: string[], action: Action, cmt: string) {
    if (ids.length === 0) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    ids.forEach((id) => fd.append("ids", id));
    fd.append("action", action);
    fd.append("comment", cmt);
    const res = await decideWorkitems({}, fd);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      router.refresh(); // resync (optimistické odebrání vrátíme)
    } else {
      setComment("");
      router.refresh();
    }
  }

  // swipe handlery (optimisticky odeber z fronty)
  function onDecision(id: string, action: Action, cmt: string) {
    setQueue((q) => q.filter((i) => i.id !== id));
    run([id], action, cmt);
  }
  function onMoveToEnd(id: string) {
    setQueue((q) => {
      const i = q.find((x) => x.id === id);
      if (!i) return q;
      return [...q.filter((x) => x.id !== id), i];
    });
  }

  // list handlery
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function bulk(action: Action) {
    run([...selected], action, comment);
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-10 text-center text-muted ring-1 ring-line">
        Nemáš nic ke schválení. 🎉
      </p>
    );
  }

  const companyGroups = agg(filtered, (i) => [i.dataArea, i.dataAreaName ?? i.dataArea]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  return (
    <div>
      {/* Hlavička */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Ke schválení <span className="text-muted">· {filtered.length}</span>
        </h1>
        {isMobile && (
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
            <button
              onClick={() => setMode("list")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${mode === "list" ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
            >
              Seznam
            </button>
            <button
              onClick={() => setMode("swipe")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${mode === "swipe" ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
            >
              Swipe
            </button>
          </div>
        )}
      </div>

      {/* Přehled / agregace */}
      <div className="mb-4 space-y-2">
        <Chips
          title="Podle typu"
          entries={byType}
          active={fType}
          onPick={(k) => setFType((p) => (p === k ? null : k))}
        />
        <Chips
          title="Podle firmy"
          entries={byCompany}
          active={fCompany}
          onPick={(k) => setFCompany((p) => (p === k ? null : k))}
        />
        {(fType || fCompany) && (
          <button
            onClick={() => {
              setFType(null);
              setFCompany(null);
            }}
            className="text-xs text-accent hover:underline"
          >
            Zrušit filtr ({filtered.length})
          </button>
        )}
      </div>

      {msg && <p className="mb-3 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{msg}</p>}

      {mode === "swipe" ? (
        <SwipeDeck queue={queue} onDecision={onDecision} onMoveToEnd={onMoveToEnd} pending={busy} />
      ) : (
        <div>
          {/* Hromadný výběr – ovládání */}
          <div className="mb-3 flex items-center gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((i) => i.id)) : new Set())
                }
              />
              Vybrat vše
            </label>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-accent hover:underline">
                Zrušit výběr ({selected.size})
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 pb-28">
            {companyGroups.map(([code, info]) => {
              const groupItems = filtered.filter((i) => i.dataArea === code);
              return (
                <div key={code} className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
                  <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-fg">
                    {info.label}{" "}
                    <span className="font-normal text-muted">({info.count})</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {groupItems.map((it) => {
                      const amt = amountLabel(it);
                      const bad = it.checks.some((c) => c.ok === false);
                      const sel = selected.has(it.id);
                      return (
                        <li
                          key={it.id}
                          className={`flex items-center gap-3 px-4 py-3 transition ${sel ? "bg-accent/10" : "hover:bg-surface-2"}`}
                        >
                          <input type="checkbox" checked={sel} onChange={() => toggle(it.id)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-fg">
                              {it.title}
                              {it.priority === "high" && (
                                <span className="ml-2 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-300">
                                  priorita
                                </span>
                              )}
                              {bad && (
                                <span className="ml-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">
                                  kontrola
                                </span>
                              )}
                              {it.deferred && (
                                <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                                  odloženo
                                </span>
                              )}
                              {it.docCount > 0 && (
                                <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
                                  📎 {it.docCount}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {it.documentTypeName}
                              {it.previewFields.length > 0 &&
                                " · " + it.previewFields.map((f) => `${f.label}: ${f.value}`).join(" · ")}
                            </p>
                          </div>
                          {amt && <span className="whitespace-nowrap font-semibold text-fg">{amt}</span>}
                          <Link
                            href={`/zaznamy/${it.id}`}
                            className="text-sm font-medium text-accent hover:underline"
                          >
                            Detail
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Hromadná lišta */}
          {selected.size > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-3 backdrop-blur">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-1">
                <span className="text-sm font-medium text-fg">Vybráno {selected.size}</span>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Komentář…"
                  className="min-w-40 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                />
                <button onClick={() => bulk("DEFER")} disabled={busy} className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  Odložit
                </button>
                <button onClick={() => bulk("REJECT")} disabled={busy} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  Zamítnout
                </button>
                <button onClick={() => bulk("APPROVE")} disabled={busy} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  Schválit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chips({
  title,
  entries,
  active,
  onPick,
}: {
  title: string;
  entries: [string, { label: string; count: number }][];
  active: string | null;
  onPick: (key: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, info]) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className={`group flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium ring-1 transition ${
                on
                  ? "bg-accent text-white ring-accent shadow-sm shadow-accent/30"
                  : "bg-surface text-fg ring-line hover:bg-surface-2 hover:ring-accent/50"
              }`}
            >
              <span className="truncate">{info.label}</span>
              <span
                className={`min-w-5 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${
                  on ? "bg-white/20 text-white" : "bg-surface-2 text-muted group-hover:text-fg"
                }`}
              >
                {info.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
