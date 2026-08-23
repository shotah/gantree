import { denyUnlessAdmin, withDoor } from "@/lib/yard/door";
import { getMe } from "@/lib/yard/host/telegram";

export const POST = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return Response.json({ ok: false, detail: "token required" }, { status: 400 });
  }
  const result = await getMe(token);
  return Response.json(
    { ok: result.ok, bot: result.bot, link: result.link, detail: result.detail },
    { status: result.ok ? 200 : 400 },
  );
});
