import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { envKeyNames, parseMcpToml, readText } from "../host/files";
import type { CraneNag, GantryCard, McpSnapshot } from "../types";
import { loadCatalog } from "./catalog";
import { envKeysForServer } from "./packages";

function dirHasFile(dir: string, depth = 2): boolean {
  if (depth < 0) {
    return false;
  }
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return false;
  }
  for (const name of names) {
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (st.isFile() && st.size > 0) {
        return true;
      }
      if (st.isDirectory() && dirHasFile(p, depth - 1)) {
        return true;
      }
    } catch {
      /* skip */
    }
  }
  return false;
}

/** Flat `{name}-oauth.json` or MCP token dirs under `data/.config/`. */
export function oauthSessionPresent(dataDir: string | null | undefined, name: string, command?: string): boolean {
  if (!dataDir) {
    return false;
  }
  const roots = [resolve(dataDir, `${name}-oauth.json`), resolve(dataDir, ".config", name), resolve(dataDir, ".config", `${name}-mcp`)];
  if (command && command !== name && command !== `${name}-mcp`) {
    roots.push(resolve(dataDir, ".config", command));
  }
  for (const p of roots) {
    try {
      const st = statSync(p);
      if (st.isFile() && st.size > 0) {
        return true;
      }
      if (st.isDirectory() && dirHasFile(p)) {
        return true;
      }
    } catch {
      /* missing */
    }
  }
  return false;
}

/** Listed vs likely-skipped from files only — no docker exec, no invented series. */
export function mcpSnapshot(g: Pick<GantryCard, "mcpManifest" | "envFile" | "dataDir">): McpSnapshot {
  const servers = parseMcpToml(readText(g.mcpManifest));
  const env = envKeyNames(g.envFile);
  const catalog = loadCatalog();
  const skippedNames: string[] = [];
  const authMissing: string[] = [];
  for (const s of servers) {
    const cat = catalog.find((c) => c.name === s.name);
    const missing = envKeysForServer(s, catalog).filter((k) => !env.valuesPresent[k]);
    if (missing.length > 0) {
      skippedNames.push(s.name);
      continue;
    }
    const needsAuth = Boolean(s.auth_args?.length || cat?.auth_args?.length);
    if (needsAuth && !oauthSessionPresent(g.dataDir, s.name, s.command ?? cat?.command)) {
      skippedNames.push(s.name);
      authMissing.push(s.name);
    }
  }
  const listed = servers.length;
  const skipped = skippedNames.length;
  return { listed, published: Math.max(0, listed - skipped), skipped, skippedNames, authMissing };
}

export function mcpHint(snap: McpSnapshot): string | null {
  if (snap.listed === 0) {
    return null;
  }
  if (snap.skipped === 0) {
    return `${snap.published} published`;
  }
  return `${snap.published} published · ${snap.skipped} skipped (${snap.skippedNames.join(", ")})`;
}

/** Board badges from docker state + file-based snapshot. Empty is honest, not fake-green. */
export function craneNags(
  state: GantryCard["state"],
  snap: McpSnapshot,
  opts?: { dockerPending?: boolean },
): CraneNag[] {
  const nags: CraneNag[] = [];
  if (!opts?.dockerPending && state !== "running" && state !== "restarting") {
    nags.push({ kind: "dead", detail: `process ${state}` });
  }
  for (const name of snap.authMissing) {
    nags.push({ kind: "auth", detail: `${name} needs auth` });
  }
  const other = snap.skippedNames.filter((n) => !snap.authMissing.includes(n));
  if (other.length) {
    nags.push({ kind: "skipped", detail: `skipped ${other.join(", ")}` });
  }
  return nags;
}
