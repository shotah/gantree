import { loginOperator, sessionCookieHeader } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; passphrase?: string };
  const result = loginOperator(String(body.name ?? ""), String(body.passphrase ?? ""));
  if (!result.ok) {
    return Response.json(
      { error: result.error, ...(result.setup ? { setup: true } : {}) },
      { status: 401 },
    );
  }
  return Response.json(
    { ok: true, operator: result.operator },
    { headers: { "Set-Cookie": sessionCookieHeader(result.token, req) } },
  );
}
