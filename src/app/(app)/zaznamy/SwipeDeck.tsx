"use client";

import { useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { amountLabel, type ApprovalItem } from "./types";

type Action = "APPROVE" | "REJECT" | "DEFER";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC", // ERP časy ukládáme jako UTC wall-clock
  }).format(new Date(iso));
}

export function SwipeDeck({
  queue,
  onDecision,
  pending,
}: {
  queue: ApprovalItem[];
  onDecision: (id: string, action: Action, comment: string) => void;
  pending: boolean;
}) {
  const [comment, setComment] = useState("");
  const [needComment, setNeedComment] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const okOpacity = useTransform(x, [30, 150], [0, 1]);
  const noOpacity = useTransform(x, [-150, -30], [1, 0]);
  const deferOpacity = useTransform(y, [40, 150], [0, 1]);

  const item = queue[0];
  const next = queue[1];

  function reset() {
    x.set(0);
    y.set(0);
  }

  async function fly(action: Action) {
    if (!item) return;
    if (action === "REJECT" && item.requireCommentOnReject && !comment.trim()) {
      setNeedComment(true);
      animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
      return;
    }
    if (action === "APPROVE") await animate(x, 500, { duration: 0.25 });
    else if (action === "REJECT") await animate(x, -500, { duration: 0.25 });
    else await animate(y, 500, { duration: 0.25 });
    onDecision(item.id, action, comment.trim());
    setComment("");
    setNeedComment(false);
    reset();
  }

  function handleDragEnd(
    _e: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } },
  ) {
    const { offset, velocity } = info;
    if (offset.x > 120 || velocity.x > 700) fly("APPROVE");
    else if (offset.x < -120 || velocity.x < -700) fly("REJECT");
    else if (offset.y > 130) fly("DEFER");
    else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
      animate(y, 0, { type: "spring", stiffness: 300, damping: 25 });
    }
  }

  if (!item) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-12 text-center text-sm text-muted">
        Nic ke schválení.
      </p>
    );
  }

  const amt = amountLabel(item);
  const failed = item.checks.filter((c) => c.ok === false);

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <p className="mb-3 text-center text-xs text-muted">{queue.length} ve frontě</p>

      <div className="relative h-[26rem]">
        {/* karta v pozadí (peek) */}
        {next && (
          <div className="absolute inset-x-2 top-3 h-full scale-[0.97] rounded-2xl bg-surface opacity-60 ring-1 ring-line" />
        )}

        {/* horní karta */}
        <motion.div
          key={item.id}
          drag
          dragSnapToOrigin
          style={{ x, y, rotate }}
          onDragEnd={handleDragEnd}
          whileTap={{ cursor: "grabbing" }}
          className="absolute inset-0 flex cursor-grab flex-col rounded-2xl bg-surface p-5 shadow-lg ring-1 ring-line"
        >
          {/* overlay štítky podle směru tažení */}
          <motion.div style={{ opacity: okOpacity }} className="pointer-events-none absolute left-4 top-4 rotate-[-12deg] rounded-md border-2 border-green-500 px-3 py-1 text-lg font-bold text-green-600">
            SCHVÁLIT
          </motion.div>
          <motion.div style={{ opacity: noOpacity }} className="pointer-events-none absolute right-4 top-4 rotate-[12deg] rounded-md border-2 border-red-500 px-3 py-1 text-lg font-bold text-red-600">
            ZAMÍTNOUT
          </motion.div>
          <motion.div style={{ opacity: deferOpacity }} className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-base font-bold text-amber-600">
            ↓ ODLOŽIT
          </motion.div>

          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted">{item.org}</span>
            <div className="flex items-center gap-1">
              {item.docCount > 0 && (
                <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent">
                  📎 {item.docCount}
                </span>
              )}
              {item.priority === "high" && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  priorita
                </span>
              )}
              {item.deferred && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  odloženo
                </span>
              )}
            </div>
          </div>

          <h2 className="mt-1 line-clamp-2 text-xl font-semibold text-brand">{item.title}</h2>
          <p className="text-sm text-muted">
            {item.documentTypeName} · {item.dataAreaName ?? item.dataArea}
          </p>
          {(item.dueAt || item.originator) && (
            <p className="mt-1 text-xs">
              {item.dueAt && (
                <span className={item.overdue ? "font-medium text-red-600" : "text-amber-600"}>
                  termín {fmtDate(item.dueAt)}
                  {item.overdue ? " (po termínu)" : ""}
                </span>
              )}
              {item.originator && <span className="text-muted"> · od {item.originator}</span>}
            </p>
          )}
          {amt && <p className="mt-3 text-3xl font-bold text-brand">{amt}</p>}

          {/* zvolená preview pole */}
          {item.previewFields.length > 0 && (
            <dl className="mt-3 space-y-0.5 text-sm">
              {item.previewFields.map((f) => (
                <div key={f.label} className="flex justify-between gap-3">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="truncate text-brand">{f.value || "–"}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* automatické kontroly */}
          {item.checks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.checks.map((c) => (
                <span
                  key={c.label}
                  title={c.message}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.ok === true
                      ? "bg-green-100 text-green-700"
                      : c.ok === false
                        ? "bg-red-100 text-red-700"
                        : "bg-surface-2 text-muted"
                  }`}
                >
                  {c.ok === true ? "✓" : c.ok === false ? "✕" : "•"} {c.label}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto pt-3">
            {item.suggestedAction === "APPROVE" && failed.length === 0 && (
              <p className="mb-1 text-xs text-green-600">Návrh: schválit (vše v pořádku)</p>
            )}
            <Link
              href={`/zaznamy/${item.id}`}
              className="text-sm font-medium text-brand-accent hover:underline"
            >
              Otevřít detail →
            </Link>
          </div>
        </motion.div>
      </div>

      {/* komentář */}
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={needComment ? "Komentář je u zamítnutí povinný…" : "Komentář (volitelné)…"}
        className={`mt-4 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-accent ${
          needComment ? "border-red-400" : "border-line"
        }`}
      />

      {/* tlačítka pro všechny akce */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => fly("REJECT")}
          disabled={pending}
          className="rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          ✕ Zamítnout
        </button>
        <button
          onClick={() => fly("DEFER")}
          disabled={pending}
          className="rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          ↓ Odložit
        </button>
        <button
          onClick={() => fly("APPROVE")}
          disabled={pending || item.approveBlocked}
          title={item.approveBlocked ? "Nad limit – nelze schválit v aplikaci" : ""}
          className="rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          ✓ Schválit
        </button>
      </div>
    </div>
  );
}
