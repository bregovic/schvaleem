"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decideWorkitems } from "../actions";
import { SwipeDeck } from "./SwipeDeck";
import { amountLabel, type ApprovalItem } from "./types";
import type { Dict } from "@/lib/i18n";

type Action = "APPROVE" | "REJECT" | "DEFER";
type SortBy = "default" | "due" | "priority";

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

function fmtShort(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// Stav validací: ok = vše prošlo, bad = něco selhalo, none = bez kontrol.
function checkState(it: ApprovalItem): "ok" | "bad" | "none" {
  if (!it.checks.length) return "none";
  if (it.checks.some((c) => c.ok === false)) return "bad";
  if (it.checks.every((c) => c.ok === true)) return "ok";
  return "none";
}

function sortItems(arr: ApprovalItem[], sortBy: SortBy): ApprovalItem[] {
  if (sortBy === "default") return arr;
  const a = [...arr];
  if (sortBy === "due") {
    a.sort((x, y) => {
      const dx = x.dueAt ? Date.parse(x.dueAt) : Number.POSITIVE_INFINITY;
      const dy = y.dueAt ? Date.parse(y.dueAt) : Number.POSITIVE_INFINITY;
      return dx - dy;
    });
  } else if (sortBy === "priority") {
    a.sort((x, y) => (x.priority === y.priority ? 0 : x.priority === "high" ? -1 : 1));
  }
  return a;
}

export function ApprovalHub({ items, t }: { items: ApprovalItem[]; t: Dict }) {
  const router = useRouter();
  const [mode, setModeState] = useState<"swipe" | "list">("list");
  const [fType, setFType] = useState<string | null>(null);
  const [fCompany, setFCompany] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [queue, setQueue] = useState<ApprovalItem[]>(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Volba režimu: zapamatovaná (localStorage) > výchozí podle zařízení.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("schvaleem.viewMode");
    } catch {}
    if (saved === "swipe" || saved === "list") {
      setModeState(saved);
      return;
    }
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    setModeState(mq.matches ? "swipe" : "list");
  }, []);

  function setMode(m: "swipe" | "list") {
    setModeState(m);
    try {
      localStorage.setItem("schvaleem.viewMode", m);
    } catch {}
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!fType || i.documentType === fType) &&
        (!fCompany || i.dataArea === fCompany) &&
        (!q || i.search.includes(q)),
    );
  }, [items, fType, fCompany, query]);
  const ordered = useMemo(() => sortItems(filtered, sortBy), [filtered, sortBy]);

  // resync fronty po změně dat / filtru / řazení
  const orderedKey = ordered.map((i) => i.id).join(",");
  useEffect(() => {
    setQueue(ordered);
    setSelected(new Set());
  }, [orderedKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      router.refresh();
    } else {
      setComment("");
      router.refresh();
    }
  }

  function onDecision(id: string, action: Action, cmt: string) {
    setQueue((q) => q.filter((i) => i.id !== id));
    run([id], action, cmt);
  }

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
      <p className="rounded-2xl border border-line bg-surface p-12 text-center text-sm text-muted">
        {t.records.empty}
      </p>
    );
  }

  // Seskupení (list): společnost → typ dokumentu.
  const companyGroups = agg(ordered, (i) => [i.dataArea, i.dataAreaName ?? i.dataArea]);
  const allFilteredSelected = ordered.length > 0 && ordered.every((i) => selected.has(i.id));
  const activeFilters = (fType ? 1 : 0) + (fCompany ? 1 : 0) + (sortBy !== "default" ? 1 : 0);

  return (
    <div>
      {/* Hlavička – kompaktní, ať na mobilu zbyde místo na kartu */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          {t.records.title} <span className="text-muted">· {ordered.length}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-line hover:text-fg"
          >
            <IconFilter />
            {activeFilters > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white">
                {activeFilters}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
            <button
              onClick={() => setMode("list")}
              title={t.records.list}
              aria-label={t.records.list}
              className={`rounded-full p-2 transition ${mode === "list" ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
            >
              <IconList />
            </button>
            <button
              onClick={() => setMode("swipe")}
              title={t.records.cards}
              aria-label={t.records.cards}
              className={`rounded-full p-2 transition ${mode === "swipe" ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
            >
              <IconCards />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <IconSearch />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.records.search}
          className="w-full rounded-full border border-line bg-surface-2 py-2 pl-9 pr-9 text-sm text-fg outline-none focus:border-accent"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={t.records.clearFilter}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
          >
            ✕
          </button>
        )}
      </div>

      {msg && <p className="mb-3 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{msg}</p>}

      {mode === "swipe" ? (
        <SwipeDeck queue={queue} onDecision={onDecision} pending={busy} t={t} />
      ) : (
        <div>
          {/* Hromadný výběr */}
          <div className="mb-3 flex items-center gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(ordered.map((i) => i.id)) : new Set())
                }
              />
              {t.records.selectAll}
            </label>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-accent hover:underline">
                {t.records.clearSelection} ({selected.size})
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 pb-28">
            {companyGroups.length === 0 && (
              <p className="rounded-lg bg-surface p-8 text-center text-sm text-muted ring-1 ring-line">
                {t.records.noResults}
              </p>
            )}
            {companyGroups.map(([code, info]) => {
              const groupItems = ordered.filter((i) => i.dataArea === code);
              const typeGroups = agg(groupItems, (i) => [i.documentType, i.documentTypeName]);
              return (
                <div key={code} className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
                  <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-fg">
                    {info.label} <span className="font-normal text-muted">({info.count})</span>
                  </div>
                  {typeGroups.map(([typeCode, typeInfo]) => (
                    <div key={typeCode}>
                      <div className="bg-surface-2/40 px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                        {typeInfo.label} ({typeInfo.count})
                      </div>
                      <ul className="divide-y divide-line">
                        {groupItems
                          .filter((i) => i.documentType === typeCode)
                          .map((it) => (
                            <Row
                              key={it.id}
                              it={it}
                              t={t}
                              selected={selected.has(it.id)}
                              onToggle={() => toggle(it.id)}
                            />
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-3 backdrop-blur">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-1">
                <span className="text-sm font-medium text-fg">
                  {t.records.selected} {selected.size}
                </span>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.records.comment}
                  className="min-w-40 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                />
                <button onClick={() => bulk("DEFER")} disabled={busy} className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  {t.records.defer}
                </button>
                <button onClick={() => bulk("REJECT")} disabled={busy} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {t.records.reject}
                </button>
                <button onClick={() => bulk("APPROVE")} disabled={busy} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {t.records.approve}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {filterOpen && (
        <FilterDialog
          t={t}
          byType={byType}
          byCompany={byCompany}
          fType={fType}
          fCompany={fCompany}
          sortBy={sortBy}
          onType={setFType}
          onCompany={setFCompany}
          onSort={setSortBy}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function Row({
  it,
  t,
  selected,
  onToggle,
}: {
  it: ApprovalItem;
  t: Dict;
  selected: boolean;
  onToggle: () => void;
}) {
  const amt = amountLabel(it);
  const cs = checkState(it);
  return (
    <li className={`flex items-start gap-3 px-4 py-3 transition ${selected ? "bg-accent/10" : "hover:bg-surface-2"}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 shrink-0"
      />
      <span
        title={cs === "ok" ? "OK" : cs === "bad" ? t.records.check : ""}
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          cs === "ok" ? "bg-green-500" : cs === "bad" ? "bg-red-500" : "bg-slate-500/40"
        }`}
      />
      <Link href={`/zaznamy/${it.id}`} className="block min-w-0 flex-1">
        {/* řádek 1: dodavatel přes celou šířku */}
        <p className="font-medium text-fg">
          {it.title}
          {it.priority === "high" && (
            <span className="ml-2 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-300">
              {t.records.priority}
            </span>
          )}
          {it.deferred && (
            <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
              {t.records.deferred}
            </span>
          )}
          {it.docCount > 0 && (
            <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
              📎 {it.docCount}
            </span>
          )}
        </p>
        {/* řádek 2: číslo faktury vlevo, částka vpravo */}
        {(it.invoiceNo || amt) && (
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-muted">{it.invoiceNo ?? ""}</span>
            {amt && <span className="shrink-0 whitespace-nowrap font-semibold text-fg">{amt}</span>}
          </div>
        )}
        {it.popis && <p className="line-clamp-1 text-xs text-muted">{it.popis}</p>}
        <p className="mt-0.5 flex gap-x-3 truncate text-xs text-muted">
          {it.dueAt && (
            <span className={`whitespace-nowrap ${it.overdue ? "text-red-400" : ""}`}>
              {t.records.dueShort}: {fmtShort(it.dueAt)}
            </span>
          )}
          <span className="whitespace-nowrap">
            {t.records.created}: {fmtShort(it.createdAt)}
          </span>
        </p>
      </Link>
    </li>
  );
}

function FilterDialog({
  t,
  byType,
  byCompany,
  fType,
  fCompany,
  sortBy,
  onType,
  onCompany,
  onSort,
  onClose,
}: {
  t: Dict;
  byType: [string, { label: string; count: number }][];
  byCompany: [string, { label: string; count: number }][];
  fType: string | null;
  fCompany: string | null;
  sortBy: SortBy;
  onType: (v: string | null) => void;
  onCompany: (v: string | null) => void;
  onSort: (v: SortBy) => void;
  onClose: () => void;
}) {
  const sel =
    "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 ring-1 ring-line sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">{t.records.sortLabel} & {t.records.typeFilter}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg" aria-label="Zavřít">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.records.typeFilter}
            <select className={sel} value={fType ?? ""} onChange={(e) => onType(e.target.value || null)}>
              <option value="">{t.records.all}</option>
              {byType.map(([k, info]) => (
                <option key={k} value={k}>{info.label} ({info.count})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.records.companyFilter}
            <select className={sel} value={fCompany ?? ""} onChange={(e) => onCompany(e.target.value || null)}>
              <option value="">{t.records.all}</option>
              {byCompany.map(([k, info]) => (
                <option key={k} value={k}>{info.label} ({info.count})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.records.sortLabel}
            <select className={sel} value={sortBy} onChange={(e) => onSort(e.target.value as SortBy)}>
              <option value="default">{t.records.sortDefault}</option>
              <option value="due">{t.records.sortDue}</option>
              <option value="priority">{t.records.sortPriority}</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            onClick={() => {
              onType(null);
              onCompany(null);
              onSort("default");
            }}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-fg"
          >
            {t.records.clearFilter}
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <line x1="3.5" y1="6" x2="3.5" y2="6" />
      <line x1="3.5" y1="12" x2="3.5" y2="12" />
      <line x1="3.5" y1="18" x2="3.5" y2="18" />
    </svg>
  );
}

function IconCards() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="3" width="14" height="16" rx="2" opacity="0.45" />
      <rect x="3" y="6" width="14" height="15" rx="2" />
    </svg>
  );
}
