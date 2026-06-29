import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import {
  upsertDocTypeConfig,
  deleteDocTypeConfig,
  addField,
  deleteField,
  addAction,
  deleteAction,
  addCheck,
  deleteCheck,
} from "../config-actions";

const FIELD_ROLES = ["TITLE", "AMOUNT", "CURRENCY", "DETAIL", "HIDDEN"];
const ACTION_KINDS = ["APPROVE", "REJECT", "OTHER"];
const THRESHOLD_ACTIONS = ["NONE", "REQUIRE_COMMENT", "BLOCK"];
const CHECK_TYPES = ["BANK_ACCOUNT_CZ", "ICO_CZ", "IBAN", "DIC_CZ"];

const inp =
  "rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-accent";

export default async function KonfiguracePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/zaznamy");
  const t = getDict(user.locale);

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      configs: {
        orderBy: { documentType: "asc" },
        include: {
          fields: { orderBy: { order: "asc" } },
          actions: { orderBy: { order: "asc" } },
          checks: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand">{t.admin.configTitle}</h1>
        <Link href="/sprava" className="text-sm text-muted hover:underline">
          {t.admin.backToAdmin}
        </Link>
      </div>

      {orgs.length === 0 && (
        <p className="rounded-lg bg-surface p-6 text-muted ring-1 ring-line">
          {t.admin.createOrgFirstPre}
          <Link href="/sprava/organizace" className="text-brand-accent hover:underline">
            {t.admin.navOrganizations}
          </Link>
          {t.admin.createOrgFirstPost}
        </p>
      )}

      {/* Vytvoření konfigurace */}
      {orgs.length > 0 && (
        <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
          <h2 className="mb-3 text-sm font-semibold text-muted">{t.admin.newConfig}</h2>
          <form action={upsertDocTypeConfig} className="flex flex-wrap items-center gap-2">
            <select name="organizationId" required className={inp}>
              <option value="">{t.admin.orgPlaceholder}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input name="documentType" required placeholder={t.admin.documentTypePlaceholder} className={inp} />
            <input name="name" placeholder={t.admin.configNamePlaceholder} className={inp} />
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" name="requireCommentOnReject" defaultChecked /> {t.admin.commentOnReject}
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" name="requireCommentOnApprove" /> {t.admin.commentOnApprove}
            </label>
            <input name="amountThreshold" placeholder={t.admin.amountThresholdPlaceholder} className={`${inp} w-28`} />
            <select name="thresholdAction" className={inp} defaultValue="NONE">
              {THRESHOLD_ACTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
              {t.admin.saveConfig}
            </button>
          </form>
        </section>
      )}

      {/* Existující konfigurace */}
      {orgs.map((o) =>
        o.configs.map((c) => (
          <section key={c.id} className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-brand">
                {o.name} · {c.name ?? c.documentType}
                {c.name && (
                  <span className="ml-2 font-mono text-xs font-normal text-muted">
                    ({c.documentType})
                  </span>
                )}
              </h2>
              <form action={deleteDocTypeConfig}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-red-600 hover:underline">{t.admin.deleteConfig}</button>
              </form>
            </div>

            {/* Pravidla */}
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">{t.admin.rules}</p>
              <form action={upsertDocTypeConfig} className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <input type="hidden" name="organizationId" value={o.id} />
                <input type="hidden" name="documentType" value={c.documentType} />
                <input name="name" defaultValue={c.name ?? ""} placeholder={t.admin.colName} className={inp} />
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="requireCommentOnReject" defaultChecked={c.requireCommentOnReject} /> {t.admin.commentOnReject}
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="requireCommentOnApprove" defaultChecked={c.requireCommentOnApprove} /> {t.admin.commentOnApprove}
                </label>
                <span>{t.admin.limitLabel}</span>
                <input name="amountThreshold" defaultValue={c.amountThreshold ? String(c.amountThreshold) : ""} placeholder="—" className={`${inp} w-24`} />
                <select name="thresholdAction" defaultValue={c.thresholdAction} className={inp}>
                  {THRESHOLD_ACTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button className="rounded-md bg-surface-2 px-3 py-1 font-medium text-muted hover:bg-line">
                  {t.admin.saveRules}
                </button>
              </form>
            </div>

            {/* Pole (atributy) */}
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                {t.admin.fieldsTitle}
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {c.fields.map((f) => (
                    <tr key={f.id}>
                      <td className="py-1.5 font-mono text-muted">{f.jsonKey}</td>
                      <td className="py-1.5 text-brand">{f.label}</td>
                      <td className="py-1.5 text-muted">
                        {f.role}
                        {f.preview && (
                          <span className="ml-1 rounded bg-brand-accent/10 px-1 text-xs text-brand-accent">
                            {t.admin.preview}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-muted">#{f.order}</td>
                      <td className="py-1.5 text-right">
                        <form action={deleteField}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="text-red-600 hover:underline">×</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {c.fields.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 text-muted">
                        {t.admin.noFields}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <form action={addField} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="configId" value={c.id} />
                <input name="jsonKey" required placeholder={t.admin.jsonKeyPlaceholder} className={inp} />
                <input name="label" placeholder={t.admin.labelPlaceholder} className={inp} />
                <select name="role" defaultValue="DETAIL" className={inp}>
                  {FIELD_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input type="checkbox" name="preview" /> {t.admin.preview}
                </label>
                <input name="order" type="number" defaultValue={0} className={`${inp} w-16`} />
                <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
                  {t.admin.addFieldBtn}
                </button>
              </form>
            </div>

            {/* Metody (akce) */}
            <div className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                {t.admin.actionsTitle}
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {c.actions.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {a.label} ({a.code}/{a.kind})
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-muted hover:text-red-600">×</button>
                    </form>
                  </span>
                ))}
                {c.actions.length === 0 && (
                  <span className="text-xs text-muted">{t.admin.noActions}</span>
                )}
              </div>
              <form action={addAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="configId" value={c.id} />
                <input name="code" required placeholder={t.admin.actionCodePlaceholder} className={inp} />
                <input name="label" placeholder={t.admin.labelPlaceholder} className={inp} />
                <select name="kind" defaultValue="OTHER" className={inp}>
                  {ACTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
                  {t.admin.addActionBtn}
                </button>
              </form>
            </div>

            {/* Automatické kontroly */}
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                {t.admin.checksTitle}
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {c.checks.map((ch) => (
                  <span key={ch.id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {ch.label} ({ch.type} ← {ch.jsonKey})
                    <form action={deleteCheck} className="inline">
                      <input type="hidden" name="id" value={ch.id} />
                      <button className="text-muted hover:text-red-600">×</button>
                    </form>
                  </span>
                ))}
                {c.checks.length === 0 && (
                  <span className="text-xs text-muted">{t.admin.noChecks}</span>
                )}
              </div>
              <form action={addCheck} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="configId" value={c.id} />
                <select name="type" defaultValue="BANK_ACCOUNT_CZ" className={inp}>
                  {CHECK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input name="jsonKey" required placeholder={t.admin.checkJsonKeyPlaceholder} className={inp} />
                <input name="label" placeholder={t.admin.labelPlaceholder} className={inp} />
                <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
                  {t.admin.addCheckBtn}
                </button>
              </form>
            </div>
          </section>
        )),
      )}
    </div>
  );
}
