import { doorAuthBody, loginOperator, sessionCookieHeader } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const fields = doorAuthBody(await req.json().catch(() => null));
  if ("error" in fields) {
    return Response.json({ error: fields.error }, { status: 400 });
  }
  const result = loginOperator(fields.name, fields.passphrase);
  if (!result.ok) {
    return Response.json(
      { error: result.error, ...(result.setup ? { setup: true } : {}) },
      { status: result.status ?? 401 },
    );
  }
  return Response.json(
    { ok: true, operator: result.operator },
    { headers: { "Set-Cookie": sessionCookieHeader(result.token, req) } },
  );
}
