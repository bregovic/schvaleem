"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Heslo
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
        />
      </label>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Přihlašuji…" : "Přihlásit se"}
      </button>
    </form>
  );
}
