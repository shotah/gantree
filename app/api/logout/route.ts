import { clearSessionCookieHeader, logoutOperator, recordYardEvent } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const you = logoutOperator(req);
  if (you) {
    recordYardEvent({ kind: "logout", operatorId: you.id, detail: you.name });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader(req) } });
}
