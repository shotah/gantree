import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCatalog } from "./catalog";
import { execStatus } from "./docker";
import { envKeyNames, parseMcpToml, readText } from "./files";
import { getGantry } from "./inventory";
import type { DoctorCheck, DoctorReport } from "./types";

export async function doctor(slug: string): Promise<DoctorReport | null> {
  const g = await getGantry(slug);
  if (!g) {
    return null;
  }
  const checks: DoctorCheck[] = [];

  const running = g.state === "running";
  checks.push({
    id: "process",
    ok: running,
    detail: running ? `container ${g.containerName} is running` : `container ${g.containerName} is ${g.state}`,
  });

  if (g.health) {
    const healthy = g.health === "healthy";
    checks.push({
      id: "docker-health",
      ok: healthy,
      detail: `docker health: ${g.health}${g.mcpListed === 0 && healthy ? " (healthy, but no MCP listed)" : ""}`,
    });
  }

  if (g.personaDir) {
    const persona = existsSync(resolve(g.personaDir, "PERSONA.md"));
    checks.push({
      id: "persona",
      ok: persona,
      detail: persona ? "PERSONA.md present" : `PERSONA.md missing in ${g.personaDir}`,
    });
  } else {
    checks.push({ id: "persona", ok: true, detail: "persona path unknown (discover mode) — skipped" });
  }

  const servers = parseMcpToml(readText(g.mcpManifest));
  if (g.mcpManifest) {
    checks.push({
      id: "mcp-listed",
      ok: servers.length > 0,
      detail: servers.length ? `granted: ${servers.map((s) => s.name).join(", ")}` : "mcp.toml lists zero servers — healthy-with-zero-tools is a fail",
    });
  } else {
    checks.push({ id: "mcp-listed", ok: true, detail: "mcp.toml path unknown (discover mode) — skipped" });
  }

  const env = envKeyNames(g.envFile);
  for (const s of servers) {
    const cat = loadCatalog().find((c) => c.name === s.name);
    const missing = (cat?.envKeys ?? []).filter((k) => !env.valuesPresent[k]);
    checks.push({
      id: `env:${s.name}`,
      ok: missing.length === 0,
      detail: missing.length ? `${s.name}: missing env ${missing.join(", ")}` : `${s.name}: required env keys present (or none)`,
    });
    if (cat?.auth_args?.length) {
      const oauthFile = g.dataDir ? existsSync(resolve(g.dataDir, `${s.name}-oauth.json`)) : false;
      checks.push({
        id: `oauth:${s.name}`,
        ok: true,
        detail: oauthFile
          ? `${s.name}: oauth session file present`
          : `${s.name}: needs auth (no session file spotted; confirm in chat /auth)`,
      });
    }
  }

  if (g.containerId && running) {
    const status = await execStatus(g.containerId);
    if (status) {
      const fail = /unhealthy|error|skipped/i.test(status) && !/ok|healthy/i.test(status);
      checks.push({
        id: "gantry-status",
        ok: !fail,
        detail: status.slice(0, 400),
      });
    } else {
      checks.push({
        id: "gantry-status",
        ok: true,
        detail: "could not exec gantry status (image may hide it) — using docker + files",
      });
    }
  }

  const hard = checks.filter((c) => c.id === "process" || c.id === "mcp-listed" || c.id.startsWith("env:"));
  const ok = hard.every((c) => c.ok);
  return { slug, ok, checks };
}
