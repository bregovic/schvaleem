"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import type { Dict } from "@/lib/i18n";

const initial: LoginState = {};

export function LoginForm({ t }: { t: Dict }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {t.login.email}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-line bg-surface-2 px-3 py-2 text-base text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {t.login.password}
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-line bg-surface-2 px-3 py-2 text-base text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
        {pending ? t.login.signingIn : t.login.signIn}
      </button>
    </form>
  );
}
