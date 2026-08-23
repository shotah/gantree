import { readFileSync } from "node:fs";
import { withDoor } from "@/lib/yard/door";
import { acceptJpeg, applyAvatar, findAvatar, resolveChannelAndToken } from "@/lib/yard/host/avatar";
import { inspectByName } from "@/lib/yard/host/docker";
import { loadEnvFile } from "@/lib/yard/host/envfile";
import { getGantry } from "@/lib/yard/crane/inventory";

export const GET = withDoor(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const hit = findAvatar(g.personaDir);
  if (!hit) {
    return new Response(null, { status: 404 });
  }
  const buf = readFileSync(hit.path);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": hit.type,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (!g.personaDir) {
    return Response.json({ error: "no persona_dir" }, { status: 400 });
  }
  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const row = form.get("file");
    file = row instanceof Blob ? row : null;
  } catch {
    return Response.json({ error: "multipart file required" }, { status: 400 });
  }
  if (!file) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = acceptJpeg(bytes);
  if (!check.ok) {
    return Response.json({ error: check.detail }, { status: 400 });
  }
  const env = loadEnvFile(g.envFile);
  let inspectEnv: string[] | null = null;
  const haveChannel = Boolean((g.channel || env.CHANNEL || "").trim());
  const haveToken = Boolean((env.TELEGRAM_BOT_TOKEN || "").trim());
  if (!haveChannel || !haveToken) {
    try {
      const inspected = await inspectByName(g.containerId || g.containerName);
      inspectEnv = inspected?.info.Config.Env ?? null;
    } catch {
      inspectEnv = null;
    }
  }
  const { channel, token } = resolveChannelAndToken({
    cardChannel: g.channel,
    file: env,
    inspectEnv,
  });
  const result = await applyAvatar({
    personaDir: g.personaDir,
    channel,
    token,
    bytes,
  });
  return Response.json({ ok: true, ...result });
});
