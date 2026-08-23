import { canMutateCrane, denyUnlessCraneMutate, denyUnlessCraneRead, operatorFromRequest, recordFromRequest, withDoor } from "@/lib/yard/door";
import { resolve } from "node:path";
import { isSecretKey, loadEnvFile, maskEnv, mergeEnv, writeEnvFile } from "@/lib/yard/host/envfile";
import { parseMcpToml, readText, writeText } from "@/lib/yard/host/files";
import { getGantry } from "@/lib/yard/crane/inventory";
import { personaMarkdown, selfMarkdown } from "@/lib/yard/crane/seed";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const you = operatorFromRequest(req);
  if (new URL(req.url).searchParams.get("templates") === "1") {
    return Response.json({
      personaTemplate: personaMarkdown(slug),
      selfTemplate: selfMarkdown(),
    });
  }
  const env = loadEnvFile(g.envFile);
  return Response.json({
    persona: readText(g.personaDir ? resolve(g.personaDir, "PERSONA.md") : null),
    self: readText(g.personaDir ? resolve(g.personaDir, "SELF.md") : null),
    mcp: readText(g.mcpManifest),
    servers: parseMcpToml(readText(g.mcpManifest)),
    env: maskEnv(env),
    writable: Boolean(g.personaDir || g.mcpManifest || g.envFile) && Boolean(you && canMutateCrane(you, slug)),
  });
});

export const PUT = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as {
    persona?: string;
    self?: string;
    mcp?: string;
    env?: Record<string, string>;
    confirmToken?: boolean;
  };
  if (typeof body.persona === "string") {
    if (!g.personaDir) {
      return Response.json({ error: "no persona_dir" }, { status: 400 });
    }
    writeText(resolve(g.personaDir, "PERSONA.md"), body.persona);
  }
  if (typeof body.self === "string") {
    if (!g.personaDir) {
      return Response.json({ error: "no persona_dir" }, { status: 400 });
    }
    writeText(resolve(g.personaDir, "SELF.md"), body.self);
  }
  if (typeof body.mcp === "string") {
    if (!g.mcpManifest) {
      return Response.json({ error: "no mcp_manifest" }, { status: 400 });
    }
    writeText(g.mcpManifest, body.mcp);
  }
  if (body.env) {
    if (!g.envFile) {
      return Response.json({ error: "no env_file" }, { status: 400 });
    }
    const secretWrites = Object.entries(body.env).filter(([k, v]) => Boolean(v) && isSecretKey(k));
    if (secretWrites.length && !body.confirmToken) {
      const publicPatch = Object.fromEntries(
        Object.entries(body.env).filter(([k, v]) => !(Boolean(v) && isSecretKey(k))),
      );
      if (Object.keys(publicPatch).length) {
        writeEnvFile(g.envFile, mergeEnv(loadEnvFile(g.envFile), publicPatch));
        recordFromRequest(req, "env", slug, Object.keys(publicPatch).join(","));
      }
      return Response.json(
        {
          error: "confirmToken required to write secrets",
          saved: Object.keys(publicPatch).filter((k) => !isSecretKey(k)),
        },
        { status: 400 },
      );
    }
    writeEnvFile(g.envFile, mergeEnv(loadEnvFile(g.envFile), body.env));
    recordFromRequest(req, "env", slug, Object.keys(body.env).join(","));
  }
  return Response.json({ ok: true });
});
