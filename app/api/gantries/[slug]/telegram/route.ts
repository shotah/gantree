import { recordFromRequest, withDoor } from "@/lib/yard/door";
import { pushTelegramProfile, saveGantryAllowlist, telegramSnapshot } from "@/lib/yard/crane/telegram";
import { parseCommandLines, type TelegramCommand } from "@/lib/yard/host/telegram";

export const GET = withDoor(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const snap = await telegramSnapshot(slug);
  if (!snap) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(snap);
});

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    op?: string;
    name?: string;
    description?: string;
    shortDescription?: string;
    commands?: TelegramCommand[] | string;
    ids?: string[] | string;
  };
  if (body.op === "profile") {
    const result = await pushTelegramProfile(slug, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      shortDescription: typeof body.shortDescription === "string" ? body.shortDescription : undefined,
      commands: commandsOf(body.commands),
    });
    if (result.ok) {
      recordFromRequest(req, "telegram-profile", slug, result.detail);
    }
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body.op === "allowlist") {
    const ids = Array.isArray(body.ids) ? body.ids : typeof body.ids === "string" ? body.ids.split(/[,\s]+/) : [];
    const result = await saveGantryAllowlist(slug, ids);
    if (result.ok) {
      recordFromRequest(req, "allowlist", slug, result.allowlist.join(","));
    }
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  return Response.json({ error: "op must be profile|allowlist" }, { status: 400 });
});

function commandsOf(raw: TelegramCommand[] | string | undefined): TelegramCommand[] | undefined {
  if (typeof raw === "string") {
    return parseCommandLines(raw);
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return undefined;
}
