import { doorAuthBody, sessionCookieHeader, setupOperator, recordYardEvent } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const fields = doorAuthBody(await req.json().catch(() => null));
  if ("error" in fields) {
    return Response.json({ error: fields.error }, { status: 400 });
  }
  const result = setupOperator(fields.name, fields.passphrase);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  recordYardEvent({ kind: "setup", operatorId: result.operator.id, detail: result.operator.name });
  return Response.json(
    { ok: true, operator: result.operator },
    { status: 201, headers: { "Set-Cookie": sessionCookieHeader(result.token, req) } },
  );
}
