import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
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

  const { newKey } = await searchParams;

  const [keys, users, logs] = await Promise.all([
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.apiLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Správa</h1>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/sprava/organizace"
            className="rounded-md bg-white px-3 py-1.5 font-medium text-brand ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Organizace a dataAreas
          </Link>
          <Link
            href="/sprava/konfigurace"
            className="rounded-md bg-white px-3 py-1.5 font-medium text-brand ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Konfigurace dokumentů
          </Link>
        </nav>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="mb-1 text-sm font-semibold text-green-800">
            Nový API klíč – zkopíruj teď, znovu se nezobrazí:
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 font-mono text-sm text-brand ring-1 ring-green-300">
            {newKey}
          </code>
        </div>
      )}

      {/* API klíče */}
      <section className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          API klíče (pro AX 2012)
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">Klíč</th>
              <th className="px-4 py-2 font-medium">Stav</th>
              <th className="px-4 py-2 font-medium">Naposledy</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-2.5 font-medium text-brand">{k.name}</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{k.prefix}…</td>
                <td className="px-4 py-2.5">
                  {k.active ? (
                    <span className="text-green-700">aktivní</span>
                  ) : (
                    <span className="text-slate-400">zrušen</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{fmt(k.lastUsedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  {k.active && (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="text-red-600 hover:underline">Zrušit</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-slate-400">
                  Zatím žádné klíče.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={createApiKey} className="flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <input
            name="name"
            placeholder="Název klíče (např. AX produkce)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
            Vytvořit klíč
          </button>
        </form>
      </section>

      {/* Uživatelé */}
      <section className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Uživatelé
        </h2>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3">
              <form action={updateUser} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <span className="w-48 truncate text-slate-600" title={u.email}>
                  {u.email}
                </span>
                <input
                  name="name"
                  defaultValue={u.name ?? ""}
                  placeholder="Jméno"
                  className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <input
                  name="erpUserId"
                  defaultValue={u.erpUserId ?? ""}
                  placeholder="ERP userId"
                  className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                >
                  <option value="APPROVER">Schvalovatel</option>
                  <option value="ADMIN">Administrátor</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" name="active" defaultChecked={u.active} /> aktivní
                </label>
                <input
                  name="newPassword"
                  type="text"
                  placeholder="Nové heslo (volitelné)"
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
                />
                <button className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300">
                  Uložit
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createUser} className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <input name="name" placeholder="Jméno" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="email" type="email" required placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="erpUserId" placeholder="ERP userId" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="password" type="text" required placeholder="Heslo (min. 6)" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <select name="role" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent">
            <option value="APPROVER">Schvalovatel</option>
            <option value="ADMIN">Administrátor</option>
          </select>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
            Přidat uživatele
          </button>
        </form>
      </section>

      {/* Log volání API */}
      <section className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Poslední volání API
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Čas</th>
              <th className="px-4 py-2 font-medium">Metoda</th>
              <th className="px-4 py-2 font-medium">Endpoint</th>
              <th className="px-4 py-2 font-medium">Kód</th>
              <th className="px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-slate-500">{fmt(l.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{l.method}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{l.path}</td>
                <td className={`px-4 py-2 font-mono ${l.statusCode >= 400 ? "text-red-600" : "text-green-700"}`}>
                  {l.statusCode}
                </td>
                <td className="px-4 py-2 text-slate-400">{l.ip ?? "–"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-slate-400">
                  Zatím žádná volání.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
