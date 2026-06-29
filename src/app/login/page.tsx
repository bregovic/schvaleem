import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/zaznamy");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="schvaleem"
            width={220}
            height={64}
            priority
            className="h-auto w-56"
          />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
