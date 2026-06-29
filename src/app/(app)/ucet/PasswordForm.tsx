"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PasswordState } from "../actions";

const initial: PasswordState = {};

const inp =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initial);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Heslo bylo změněno.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Současné heslo
        <input type="password" name="current" required autoComplete="current-password" className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Nové heslo
        <input type="password" name="next" required minLength={6} autoComplete="new-password" className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Potvrzení nového hesla
        <input type="password" name="confirm" required minLength={6} autoComplete="new-password" className={inp} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Ukládám…" : "Změnit heslo"}
      </button>
    </form>
  );
}
