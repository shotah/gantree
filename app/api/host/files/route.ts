import { denyUnlessAdmin, recordFromRequest, withDoor } from "@/lib/yard/door";
import { readText, tomlPath, writeText, yardRoot } from "@/lib/yard/host/files";
import { parse } from "smol-toml";
import { resolve } from "node:path";

const TOML_MAX = 256_000;

export const GET = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const inventory = tomlPath();
  const compose = resolve(yardRoot(), "compose.yml");
  return Response.json({
    toml: readText(inventory),
    tomlPath: inventory,
    compose: readText(compose),
    composePath: compose,
  });
});

export const PUT = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const body = (await req.json()) as { toml?: string; confirm?: boolean };
  if (typeof body.toml !== "string") {
    return Response.json({ error: "toml required" }, { status: 400 });
  }
  if (!body.confirm) {
    return Response.json({ error: "confirm required to rewrite gantree.toml" }, { status: 400 });
  }
  if (body.toml.length > TOML_MAX) {
    return Response.json({ error: "toml too large" }, { status: 400 });
  }
  try {
    parse(body.toml);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "invalid toml" }, { status: 400 });
  }
  writeText(tomlPath(), body.toml);
  recordFromRequest(req, "inventory", null, "gantree.toml");
  return Response.json({ ok: true });
});
