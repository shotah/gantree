import { recordFromRequest, withDoor } from "@/lib/yard/door";
import { resolve } from "node:path";
import { loadEnvFile, maskEnv, mergeEnv, writeEnvFile } from "@/lib/yard/host/envfile";
import { parseMcpToml, readText, writeText } from "@/lib/yard/host/files";
import { getGantry } from "@/lib/yard/crane/inventory";

export const GET = withDoor(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const env = loadEnvFile(g.envFile);
  return Response.json({
    persona: readText(g.personaDir ? resolve(g.personaDir, "PERSONA.md") : null),
    self: readText(g.personaDir ? resolve(g.personaDir, "SELF.md") : null),
    mcp: readText(g.mcpManifest),
    servers: parseMcpToml(readText(g.mcpManifest)),
    env: maskEnv(env),
    writable: Boolean(g.personaDir || g.mcpManifest || g.envFile),
  });
});

export const PUT = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as {
    persona?: string;
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
    const touchingToken = Object.keys(body.env).some((k) => /TOKEN|KEY|SECRET/i.test(k) && body.env?.[k]);
    if (touchingToken && !body.confirmToken) {
      return Response.json({ error: "confirmToken required to write secrets" }, { status: 400 });
    }
    writeEnvFile(g.envFile, mergeEnv(loadEnvFile(g.envFile), body.env));
    recordFromRequest(req, "env", slug, Object.keys(body.env).join(","));
  }
  return Response.json({ ok: true });
});
