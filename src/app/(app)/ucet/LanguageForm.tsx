"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { changeLocale, type LocaleState } from "../actions";
import type { Dict } from "@/lib/i18n";

const initial: LocaleState = {};

export function LanguageForm({ t, current }: { t: Dict; current: string }) {
  const [state, formAction, pending] = useActionState(changeLocale, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <p className="text-xs text-muted">{t.account.languageHint}</p>
      <select
        name="locale"
        defaultValue={current === "en" ? "en" : "cs"}
        className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      >
        <option value="cs">Čeština</option>
        <option value="en">English</option>
      </select>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? t.account.saving : t.account.save}
        </button>
      </div>
      {state.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{t.account.saved}</p>
      )}
    </form>
  );
}
