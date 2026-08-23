import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execStatus } from "../host/docker";
import { envKeyNames, parseMcpToml, readText } from "../host/files";
import { loadCatalog } from "../tools/catalog";
import { envKeysForServer } from "../tools/packages";
import { oauthSessionPresent } from "../tools/mcp";
import type { DoctorCheck, DoctorReport } from "../types";
import { getGantry } from "./inventory";

export async function doctor(slug: string): Promise<DoctorReport | null> {
  const g = await getGantry(slug);
  if (!g) {
    return null;
  }
  const checks: DoctorCheck[] = [];

  const bouncing = g.state === "restarting";
  const running = g.state === "running";
  checks.push({
    id: "process",
    ok: running || bouncing,
    detail: running
      ? `container ${g.containerName} is running`
      : bouncing
        ? `container ${g.containerName} is restarting (reload)`
        : `container ${g.containerName} is ${g.state}`,
  });

  if (g.health) {
    const starting = g.health === "starting";
    const healthy = g.health === "healthy";
    checks.push({
      id: "docker-health",
      ok: healthy || starting,
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

  let statusServers: NonNullable<NonNullable<GantryStatusJson["mcp"]>["servers"]> = [];
  if (g.containerId && running) {
    const status = await execStatus(g.containerId);
    if (status) {
      const parsed = parseGantryStatusJson(status);
      if (parsed) {
        const operatorOk = parsed.alive !== false && parsed.ok !== false;
        const mcp = parsed.mcp;
        statusServers = mcp?.servers ?? [];
        const summary = [
          parsed.channel,
          parsed.reason,
          mcp ? `listed=${mcp.listed ?? "?"} connected=${mcp.connected ?? "?"} skipped=${mcp.skipped ?? "?"}` : null,
        ]
          .filter(Boolean)
          .join(" ");
        checks.push({
          id: "gantry-status",
          ok: operatorOk,
          detail: summary || status.slice(0, 400),
        });
      } else {
        const fail = /unhealthy|error|skipped/i.test(status) && !/ok|healthy/i.test(status);
        checks.push({
          id: "gantry-status",
          ok: !fail,
          detail: status.slice(0, 400),
        });
      }
    } else {
      checks.push({
        id: "gantry-status",
        ok: true,
        detail: "could not exec gantry status (image may hide it) — using docker + files",
      });
    }
  }

  const named = uniqueMcpServers(statusServers);
  if (named.length > 0) {
    for (const s of named) {
      const check = mcpServerCheck(s);
      if (check) {
        checks.push(check);
      }
    }
  } else {
    pushFileMcpChecks(checks, servers, g.envFile, g.dataDir);
  }

  const hard = checks.filter(
    (c) => c.id === "process" || c.id === "mcp-listed" || c.id === "gantry-status" || c.id.startsWith("env:"),
  );
  const ok = hard.every((c) => c.ok);
  return { slug, ok, checks };
}

function uniqueMcpServers(
  rows: NonNullable<NonNullable<GantryStatusJson["mcp"]>["servers"]>,
): NonNullable<NonNullable<GantryStatusJson["mcp"]>["servers"]> {
  const rank = (state: string | undefined): number => {
    if (state === "connected") {
      return 2;
    }
    if (state === "unknown") {
      return 1;
    }
    return 0;
  };
  const byName = new Map<string, (typeof rows)[number]>();
  for (const s of rows) {
    if (!s?.name) {
      continue;
    }
    const prev = byName.get(s.name);
    if (!prev || rank(s.state) > rank(prev.state)) {
      byName.set(s.name, s);
    }
  }
  return [...byName.values()];
}

function mcpServerCheck(s: NonNullable<NonNullable<GantryStatusJson["mcp"]>["servers"]>[number]): DoctorCheck | null {
  if (!s?.name) {
    return null;
  }
  if (s.state === "skipped") {
    return {
      id: `mcp:${s.name}`,
      ok: false,
      detail: `${s.name}: ${s.reason ?? "skipped"}${s.note ? ` — ${s.note}` : ""}`,
    };
  }
  if (s.state === "connected") {
    return { id: `mcp:${s.name}`, ok: true, detail: `${s.name}: connected` };
  }
  return { id: `mcp:${s.name}`, ok: true, detail: `${s.name}: unknown (no boot snapshot yet)` };
}

function pushFileMcpChecks(
  checks: DoctorCheck[],
  servers: ReturnType<typeof parseMcpToml>,
  envFile: string | null,
  dataDir: string | null,
): void {
  const env = envKeyNames(envFile);
  const catalog = loadCatalog();
  for (const s of servers) {
    const cat = catalog.find((c) => c.name === s.name);
    const missing = envKeysForServer(s, catalog).filter((k) => !env.valuesPresent[k]);
    checks.push({
      id: `env:${s.name}`,
      ok: missing.length === 0,
      detail: missing.length ? `${s.name}: missing env ${missing.join(", ")}` : `${s.name}: required env keys present (or none)`,
    });
    if (cat?.auth_args?.length || s.auth_args?.length) {
      const oauthFile = oauthSessionPresent(dataDir, s.name, cat?.command ?? s.command);
      checks.push({
        id: `oauth:${s.name}`,
        ok: true,
        detail: oauthFile
          ? `${s.name}: oauth session file present`
          : `${s.name}: needs auth (no session file spotted; confirm in chat /auth)`,
      });
    }
  }
}

/** Parse `gantry status` JSON. `"ok":false` must not be regex-matched as healthy. */
export function parseGantryStatusJson(text: string): GantryStatusJson | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const j: unknown = JSON.parse(text.slice(start, end + 1));
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      return null;
    }
    const rec = j as Record<string, unknown>;
    if (typeof rec.alive !== "boolean" && typeof rec.ok !== "boolean") {
      return null;
    }
    return rec as GantryStatusJson;
  } catch {
    return null;
  }
}

export type GantryStatusJson = {
  alive?: boolean;
  ok?: boolean;
  reason?: string;
  channel?: string;
  mcp?: {
    listed?: number;
    connected?: number;
    skipped?: number;
    servers?: Array<{
      name?: string;
      state?: string;
      reason?: string;
      note?: string;
      auth?: boolean;
    }>;
  };
};
