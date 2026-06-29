import { NextResponse } from "next/server";

// Jednoduchý test dostupnosti / TLS handshake z AX (zadání kap. 6).
export async function GET() {
  return NextResponse.json({ status: "ok", service: "schvaleem" });
}
