import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = getDict(user.locale);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <nav className="flex items-center gap-5 text-sm font-medium text-muted">
            <Link href="/zaznamy" className="flex items-center">
              <Image
                src="/icon-light.png"
                alt="schvaleem"
                width={32}
                height={32}
                priority
                className="h-8 w-8"
              />
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
