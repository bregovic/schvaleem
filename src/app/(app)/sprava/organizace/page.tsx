import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  createOrganization,
  assignDataAreas,
  unassignDataArea,
  createDataArea,
} from "../config-actions";

export default async function OrganizacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/zaznamy");

  const [orgs, dataAreas] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      include: { dataAreas: { orderBy: { code: "asc" } } },
    }),
    prisma.dataArea.findMany({
      orderBy: { code: "asc" },
      include: { organization: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand">Organizace a dataAreas</h1>
        <Link href="/sprava" className="text-sm text-slate-500 hover:underline">
          ← Správa
        </Link>
      </div>

      {/* Organizace */}
      <section className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Organizace
        </h2>
        <ul className="divide-y divide-slate-100">
          {orgs.map((o) => (
            <li key={o.id} className="px-4 py-3">
              <div className="font-medium text-brand">
                {o.name}{" "}
                <span className="text-xs font-normal text-slate-400">
                  ({o.dataAreas.length} dataAreas)
                </span>
              </div>
              {o.dataAreas.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-slate-500">
                    zobrazit dataAreas
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.dataAreas.map((a) => (
                      <span
                        key={a.id}
                        title={a.name ?? ""}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {a.code}
                        <form action={unassignDataArea} className="inline">
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-slate-400 hover:text-red-600" title="Odebrat">
                            ×
                          </button>
                        </form>
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </li>
          ))}
          {orgs.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">Zatím žádné organizace.</li>
          )}
        </ul>
        <form action={createOrganization} className="flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <input
            name="name"
            required
            placeholder="Název nové organizace"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
            Přidat organizaci
          </button>
        </form>
      </section>

      {/* Wizard přiřazení dataAreas */}
      <section className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
          Přiřadit dataAreas pod organizaci
        </h2>
        {dataAreas.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400">
            Zatím žádné dataAreas – objeví se sem automaticky, jakmile ERP pošle první workitem.
          </p>
        ) : (
          <form action={assignDataAreas} className="p-4">
            <div className="mb-3 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {dataAreas.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <input type="checkbox" name="dataAreaIds" value={a.id} />
                  <span className="font-mono font-medium text-brand">{a.code}</span>
                  <span className="truncate text-xs text-slate-500">{a.name}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                    {a.organization?.name ?? "—"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select
                name="organizationId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
              >
                <option value="">Vyber organizaci…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
                Přiřadit vybrané
              </button>
            </div>
          </form>
        )}
        {/* Ruční přidání dataArea */}
        <form action={createDataArea} className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <input name="code" required placeholder="Kód (ContextCompanyId)" className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <input name="name" placeholder="Název firmy" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent" />
          <select name="organizationId" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent">
            <option value="">— bez organizace —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
            Přidat dataArea
          </button>
        </form>
      </section>
    </div>
  );
}
