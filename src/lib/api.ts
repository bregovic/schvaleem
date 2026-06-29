import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Chybové odpovědi ve formátu, který AX umí přečíst: { error, message }
// (AX hledá klíč "error", resp. "message" – viz technické zadání kap. 5).
// ---------------------------------------------------------------------------

export function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

// ---------------------------------------------------------------------------
// Ověření statického API klíče (Authorization: Bearer <key> nebo X-API-Key)
// ---------------------------------------------------------------------------

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^(?:Bearer|OAuth)\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = req.headers.get("x-api-key");
  return x ? x.trim() : null;
}

export type AuthedKey = { id: string; name: string };

export async function authenticate(req: Request): Promise<AuthedKey | null> {
  const key = extractKey(req);
  if (!key) return null;
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: sha256(key) },
  });
  if (!apiKey || !apiKey.active) return null;
  // lastUsedAt aktualizujeme „best effort", chyba nesmí shodit request.
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { id: apiKey.id, name: apiKey.name };
}

// ---------------------------------------------------------------------------
// Audit log příchozích volání (kdo, kdy, endpoint, stavový kód)
// ---------------------------------------------------------------------------

export async function logApiRequest(params: {
  method: string;
  path: string;
  statusCode: number;
  apiKeyId?: string | null;
  ip?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    await prisma.apiLog.create({ data: params });
  } catch {
    // Logování nesmí ovlivnit odpověď klientovi.
  }
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// Společný obal: ověří klíč, zaloguje výsledek a vrátí buď handler odpověď,
// nebo 401. handler dostane ověřený klíč.
export async function withApiKey(
  req: Request,
  path: string,
  handler: (key: AuthedKey) => Promise<NextResponse>,
): Promise<NextResponse> {
  const started = Date.now();
  const ip = clientIp(req);
  const key = await authenticate(req);

  let res: NextResponse;
  if (!key) {
    res = errorResponse(
      401,
      "unauthorized",
      "Chybí nebo neplatný API klíč.",
    );
  } else {
    try {
      res = await handler(key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Neznámá chyba serveru.";
      res = errorResponse(500, "server_error", msg);
    }
  }

  await logApiRequest({
    method: req.method,
    path,
    statusCode: res.status,
    apiKeyId: key?.id ?? null,
    ip,
    durationMs: Date.now() - started,
  });

  return res;
}
