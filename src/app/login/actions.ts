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
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Vyplň email i heslo." };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Nesprávný email nebo heslo." };
  }

  await createSession(user.id);
  redirect("/zaznamy");
}
