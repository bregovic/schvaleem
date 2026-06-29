"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Vyplň přihlašovací údaj i heslo." };
  }

  const { identifier, password } = parsed.data;
  const id = identifier.trim();
  // Přihlášení přes email NEBO ERP userId.
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: id.toLowerCase() }, { erpUserId: id }] },
  });

  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Nesprávné přihlašovací údaje." };
  }

  await createSession(user.id);
  redirect("/zaznamy");
}
