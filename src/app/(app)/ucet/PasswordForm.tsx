"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PasswordState } from "../actions";
import type { Dict } from "@/lib/i18n";

const initial: PasswordState = {};

const inp =
  "rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function PasswordForm({ t }: { t: Dict }) {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initial);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t.account.changed}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {t.account.current}
        <input type="password" name="current" required autoComplete="current-password" className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {t.account.newPass}
        <input type="password" name="next" required minLength={6} autoComplete="new-password" className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {t.account.confirmPass}
        <input type="password" name="confirm" required minLength={6} autoComplete="new-password" className={inp} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? t.account.saving : t.account.changeBtn}
      </button>
    </form>
  );
}
