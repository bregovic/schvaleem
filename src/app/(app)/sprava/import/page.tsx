import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/zaznamy");
  const t = getDict(user.locale);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand">{t.admin.importTitle}</h1>
        <Link href="/sprava" className="text-sm text-muted hover:underline">
          {t.admin.backToAdmin}
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted">
        {t.admin.importDescPre}
        <code className="rounded bg-surface-2 px-1">POST /api/workitems</code>
        {t.admin.importDescMid}
        <code className="rounded bg-surface-2 px-1">workitemId</code>
        {t.admin.importDescPost}
      </p>
      <ImportForm t={t} />
    </div>
  );
}
