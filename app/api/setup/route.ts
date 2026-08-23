import { sessionCookieHeader, setupOperator, recordYardEvent } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; passphrase?: string };
  const result = setupOperator(String(body.name ?? ""), String(body.passphrase ?? ""));
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  recordYardEvent({ kind: "setup", operatorId: result.operator.id, detail: result.operator.name });
  return Response.json(
    { ok: true, operator: result.operator },
    { status: 201, headers: { "Set-Cookie": sessionCookieHeader(result.token, req) } },
  );
}
