import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/zaznamy");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand">Import workitemů (JSON)</h1>
        <Link href="/sprava" className="text-sm text-slate-500 hover:underline">
          ← Správa
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Ruční nahrání testovacích dat bez ERP API. Vlož JSON pole workitemů (stejný formát jako{" "}
        <code className="rounded bg-slate-100 px-1">POST /api/workitems</code>) nebo nahraj soubor.
        Existující workitemy (dle <code className="rounded bg-slate-100 px-1">workitemId</code>) se
        aktualizují.
      </p>
      <ImportForm />
    </div>
  );
}
