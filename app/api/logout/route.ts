import { clearSessionCookieHeader, logoutOperator } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  logoutOperator(req);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader(req) } });
}
