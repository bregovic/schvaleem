import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { PasswordForm } from "./PasswordForm";
import { LanguageForm } from "./LanguageForm";

export default async function UcetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = getDict(user.locale);

  const adminLinks = [
    { href: "/sprava/import", label: t.account.importJson },
    { href: "/sprava/konfigurace", label: t.account.configuration },
    { href: "/sprava/organizace", label: t.account.organizations },
    { href: "/sprava", label: t.account.users },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold text-fg">{t.account.title}</h1>
      <p className="mb-6 text-sm text-muted">
        {user.name ?? user.email ?? user.erpUserId} ·{" "}
        {user.role === "ADMIN" ? t.account.roleAdmin : t.account.roleApprover}
        {user.erpUserId ? ` · ${t.account.erpUserId}: ${user.erpUserId}` : ""}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-lg bg-surface p-5 ring-1 ring-line">
          <h2 className="mb-4 text-sm font-semibold text-muted">{t.account.changePassword}</h2>
          <PasswordForm t={t} />
        </section>

        <section className="rounded-lg bg-surface p-5 ring-1 ring-line">
          <h2 className="mb-4 text-sm font-semibold text-muted">{t.account.language}</h2>
          <LanguageForm t={t} current={user.locale} />
        </section>
      </div>

      {user.role === "ADMIN" && (
        <section className="mt-5 rounded-lg bg-surface p-5 ring-1 ring-line">
          <h2 className="mb-4 text-sm font-semibold text-muted">{t.account.adminTools}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {adminLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md border border-line px-4 py-3 text-sm font-medium text-fg transition hover:border-accent/50 hover:bg-surface-2"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
