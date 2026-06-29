import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { createApiKey, revokeApiKey, createUser, updateUser } from "../actions";

function fmt(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function SpravaPage({
  searchParams,
}: {
  searchParams: Promise<{ newKey?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/zaznamy");
  const t = getDict(user.locale);

  const { newKey } = await searchParams;

  const [keys, users, logs] = await Promise.all([
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.apiLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">{t.admin.title}</h1>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/sprava/organizace"
            className="rounded-md bg-surface px-3 py-1.5 font-medium text-brand ring-1 ring-line hover:bg-surface-2"
          >
            {t.admin.navOrganizations}
          </Link>
          <Link
            href="/sprava/konfigurace"
            className="rounded-md bg-surface px-3 py-1.5 font-medium text-brand ring-1 ring-line hover:bg-surface-2"
          >
            {t.admin.navConfig}
          </Link>
          <Link
            href="/sprava/import"
            className="rounded-md bg-surface px-3 py-1.5 font-medium text-brand ring-1 ring-line hover:bg-surface-2"
          >
            {t.admin.navImport}
          </Link>
        </nav>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="mb-1 text-sm font-semibold text-green-800">
            {t.admin.newKeyNotice}
          </p>
          <code className="block break-all rounded bg-surface px-3 py-2 font-mono text-sm text-brand ring-1 ring-green-300">
            {newKey}
          </code>
        </div>
      )}

      {/* API klíče */}
      <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
        <h2 className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
          {t.admin.apiKeysTitle}
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t.admin.colName}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colKey}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colStatus}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colLastUsed}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-2.5 font-medium text-brand">{k.name}</td>
                <td className="px-4 py-2.5 font-mono text-muted">{k.prefix}…</td>
                <td className="px-4 py-2.5">
                  {k.active ? (
                    <span className="text-green-700">{t.admin.active}</span>
                  ) : (
                    <span className="text-muted">{t.admin.revoked}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{fmt(k.lastUsedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  {k.active && (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="text-red-600 hover:underline">{t.admin.revoke}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted">
                  {t.admin.noKeys}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={createApiKey} className="flex gap-2 border-t border-line bg-surface-2 px-4 py-3">
          <input
            name="name"
            placeholder={t.admin.keyNamePlaceholder}
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
            {t.admin.createKey}
          </button>
        </form>
      </section>

      {/* Uživatelé */}
      <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
        <h2 className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
          {t.admin.usersTitle}
        </h2>
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3">
              <form action={updateUser} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <span className="w-48 truncate text-muted" title={u.email ?? u.erpUserId ?? ""}>
                  {u.email ?? u.erpUserId ?? "—"}
                </span>
                <input
                  name="name"
                  defaultValue={u.name ?? ""}
                  placeholder={t.admin.namePlaceholder}
                  className="w-32 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <input
                  name="erpUserId"
                  defaultValue={u.erpUserId ?? ""}
                  placeholder={t.admin.erpUserId}
                  className="w-32 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                >
                  <option value="APPROVER">{t.admin.roleApprover}</option>
                  <option value="ADMIN">{t.admin.roleAdmin}</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input type="checkbox" name="active" defaultChecked={u.active} /> {t.admin.active}
                </label>
                <input
                  name="newPassword"
                  type="text"
                  placeholder={t.admin.newPasswordOptional}
                  className="w-40 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <button className="rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted hover:bg-line">
                  {t.admin.save}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createUser} className="flex flex-wrap gap-2 border-t border-line bg-surface-2 px-4 py-3">
          <input name="name" placeholder={t.admin.namePlaceholder} className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="email" type="email" placeholder={t.admin.email} className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="erpUserId" placeholder={t.admin.erpUserId} className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="password" type="text" required placeholder={t.admin.passwordMin} className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <select name="role" className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-accent">
            <option value="APPROVER">{t.admin.roleApprover}</option>
            <option value="ADMIN">{t.admin.roleAdmin}</option>
          </select>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
            {t.admin.addUser}
          </button>
        </form>
      </section>

      {/* Log volání API */}
      <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
        <h2 className="border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-muted">
          {t.admin.apiLogTitle}
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t.admin.colTime}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colMethod}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colEndpoint}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colCode}</th>
              <th className="px-4 py-2 font-medium">{t.admin.colIp}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-muted">{fmt(l.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-muted">{l.method}</td>
                <td className="px-4 py-2 font-mono text-muted">{l.path}</td>
                <td className={`px-4 py-2 font-mono ${l.statusCode >= 400 ? "text-red-600" : "text-green-700"}`}>
                  {l.statusCode}
                </td>
                <td className="px-4 py-2 text-muted">{l.ip ?? "–"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted">
                  {t.admin.noLogs}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
