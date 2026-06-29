import { NextResponse } from "next/server";
import { authenticate, errorResponse, logApiRequest, clientIp } from "@/lib/api";

// POST /api/auth/token – volitelný token endpoint (zadání kap. 3.1).
// Zachovává stávající tok AX: POST přihlášení -> z odpovědi se přečte access_token.
// Jako client_secret se posílá platný API klíč; vracíme ho zpět jako access_token,
// takže další volání používají Authorization: Bearer <token> (= API klíč).
export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIp(req);

  let clientSecret: string | null = null;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const body = await req.json();
      clientSecret = body.client_secret ?? body.api_key ?? null;
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      clientSecret = params.get("client_secret") ?? params.get("api_key");
    }
  } catch {
    clientSecret = null;
  }

  // Ověříme přes Authorization hlavičku nebo client_secret z těla.
  const proxyReq = new Request(req.url, {
    headers: clientSecret
      ? { "x-api-key": clientSecret }
      : req.headers,
  });
  const key = await authenticate(proxyReq);

  let res: NextResponse;
  if (!key) {
    res = errorResponse(401, "invalid_client", "Neplatné přihlašovací údaje.");
  } else {
    res = NextResponse.json({
      access_token: clientSecret,
      token_type: "Bearer",
      expires_in: 3600,
    });
  }

  await logApiRequest({
    method: "POST",
    path: "/api/auth/token",
    statusCode: res.status,
    apiKeyId: key?.id ?? null,
    ip,
    durationMs: Date.now() - started,
  });
  return res;
}
