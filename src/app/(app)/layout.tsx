import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = getDict(user.locale);

  // Počet dokladů čekajících na tohoto uživatele – odznáček v navigaci.
  const pendingCount = user.erpUserId
    ? await prisma.workitem.count({
        where: { assigneeErpUserId: user.erpUserId, status: "PENDING" },
      })
    : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <nav className="flex items-center gap-5 text-sm font-medium text-muted">
            <Link href="/zaznamy" className="relative flex items-center">
              <Image
                src="/icon-light.png"
                alt="schvaleem"
                width={32}
                height={32}
                priority
                className="h-8 w-8"
              />
              {pendingCount > 0 && (
                <span
                  title={`${pendingCount} ${t.nav.records}`}
                  className="absolute -right-2 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface"
                >
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
            <Link href="/zaznamy" className="hover:text-fg">
              {t.nav.records}
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/ucet" className="text-muted hover:text-fg">
              {user.name ?? user.email ?? user.erpUserId ?? "—"}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:bg-surface-2"
              >
                {t.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="w-full px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
