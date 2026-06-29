import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export default async function UcetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold text-brand">Účet</h1>
      <p className="mb-6 text-sm text-slate-500">
        {user.name ?? user.email} · {user.role === "ADMIN" ? "administrátor" : "schvalovatel"}
        {user.erpUserId ? ` · ERP userId: ${user.erpUserId}` : ""}
      </p>

      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-600">Změna hesla</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
