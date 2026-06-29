"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decideWorkitems, type DecideState } from "../../actions";
import type { Dict } from "@/lib/i18n";

const initial: DecideState = {};

export function DecideForm({ workitemId, t }: { workitemId: string; t: Dict }) {
  const [state, formAction, pending] = useActionState(decideWorkitems, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.push("/zaznamy");
  }, [state.ok, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ids" value={workitemId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <textarea
        name="comment"
        rows={2}
        placeholder={t.decide.comment}
        className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          name="action"
          value="APPROVE"
          disabled={pending}
          className="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {t.decide.approve}
        </button>
        <button
          type="submit"
          name="action"
          value="REJECT"
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {t.decide.reject}
        </button>
      </div>
    </form>
  );
}
