import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { envKeyNames, parseMcpToml, readText } from "../host/files";
import type { CraneNag, GantryCard, McpSnapshot } from "../types";
import { loadCatalog } from "./catalog";

/** Listed vs likely-skipped from files only — no docker exec, no invented series. */
export function mcpSnapshot(g: Pick<GantryCard, "mcpManifest" | "envFile" | "dataDir">): McpSnapshot {
  const servers = parseMcpToml(readText(g.mcpManifest));
  const env = envKeyNames(g.envFile);
  const skippedNames: string[] = [];
  const authMissing: string[] = [];
  for (const s of servers) {
    const cat = loadCatalog().find((c) => c.name === s.name);
    const missing = (cat?.envKeys ?? []).filter((k) => !env.valuesPresent[k]);
    if (missing.length > 0) {
      skippedNames.push(s.name);
      continue;
    }
    const needsAuth = Boolean(s.auth_args?.length || cat?.auth_args?.length);
    if (needsAuth && g.dataDir) {
      if (!existsSync(resolve(g.dataDir, `${s.name}-oauth.json`))) {
        skippedNames.push(s.name);
        authMissing.push(s.name);
      }
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
export function craneNags(state: GantryCard["state"], snap: McpSnapshot): CraneNag[] {
  const nags: CraneNag[] = [];
  if (state !== "running") {
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
