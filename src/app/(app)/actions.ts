"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, destroySession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { generateApiKey } from "@/lib/ids";
import { sha256 } from "@/lib/api";
import { resolveWorkflowDisplay, parseAmount } from "@/lib/config";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Jen administrátor.");
  return user;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Změna vlastního hesla (každý přihlášený uživatel)
// ---------------------------------------------------------------------------

export type PasswordState = { error?: string; ok?: boolean };

export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const sessionUser = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) {
    return { error: "Nové heslo musí mít aspoň 6 znaků." };
  }
  if (next !== confirm) {
    return { error: "Nové heslo a potvrzení se neshodují." };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Současné heslo není správné." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rozhodnutí o workitemech (jeden i hromadně), s vynucením pravidel z konfigurace.
// ---------------------------------------------------------------------------

export type DecideState = { error?: string; ok?: boolean; count?: number };

export async function decideWorkitems(
  _prev: DecideState,
  formData: FormData,
): Promise<DecideState> {
  const user = await requireUser();
  if (!user.erpUserId) {
    return { error: "Tvůj účet nemá přiřazené ERP userId – nemůžeš schvalovat." };
  }

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const action = String(formData.get("action") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (action !== "APPROVE" && action !== "REJECT") {
    return { error: "Neplatná akce." };
  }
  if (ids.length === 0) {
    return { error: "Nevybral jsi žádný workitem." };
  }

  const items = await prisma.workitem.findMany({
    where: {
      id: { in: ids },
      assigneeErpUserId: user.erpUserId,
      status: "PENDING",
    },
    include: { workflow: true },
  });

  if (items.length === 0) {
    return { error: "Vybrané workitemy už nejsou ke schválení." };
  }

  // Vynucení pravidel podle konfigurace typu dokumentu.
  for (const w of items) {
    const d = await resolveWorkflowDisplay(w.workflow);
    if (action === "REJECT" && d.rules.requireCommentOnReject && !comment) {
      return { error: "U zamítnutí je vyžadován komentář." };
    }
    if (action === "APPROVE" && d.rules.requireCommentOnApprove && !comment) {
      return { error: "U schválení je vyžadován komentář." };
    }
    if (action === "APPROVE" && d.rules.amountThreshold !== null) {
      const amount = parseAmount(d.amount);
      if (amount !== null && amount > d.rules.amountThreshold) {
        if (d.rules.thresholdAction === "BLOCK") {
          return {
            error: `Částka ${amount} překračuje limit ${d.rules.amountThreshold} – v aplikaci nelze schválit.`,
          };
        }
        if (d.rules.thresholdAction === "REQUIRE_COMMENT" && !comment) {
          return { error: "Částka nad limit – vyžadován komentář." };
        }
      }
    }
  }

  await prisma.workitem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      action,
      comment: comment || null,
      decidedByUserId: user.id,
      decidedAt: new Date(),
    },
  });

  revalidatePath("/zaznamy");
  return { ok: true, count: items.length };
}

// ---------------------------------------------------------------------------
// Správa: API klíče
// ---------------------------------------------------------------------------

export async function createApiKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim() || "ERP";
  const { key, prefix } = generateApiKey();
  await prisma.apiKey.create({ data: { name, prefix, keyHash: sha256(key) } });
  redirect(`/sprava?newKey=${encodeURIComponent(key)}`);
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.apiKey.update({ where: { id }, data: { active: false } });
  revalidatePath("/sprava");
}

// ---------------------------------------------------------------------------
// Správa: uživatelé (vč. erpUserId)
// ---------------------------------------------------------------------------

export async function createUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const erpUserId = String(formData.get("erpUserId") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "APPROVER";

  if (!email || password.length < 6) {
    throw new Error("Email a heslo (min. 6 znaků) jsou povinné.");
  }

  await prisma.user.create({
    data: {
      email,
      name,
      erpUserId,
      role,
      passwordHash: await hashPassword(password),
    },
  });
  revalidatePath("/sprava");
}
