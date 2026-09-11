import { getGantry } from "../crane/inventory";
import { loadEnvFile, writeEnvFile } from "../host/envfile";
import { parseMcpToml, readText, stringifyMcpToml, writeText } from "../host/files";
import type { CatalogEntry, McpServer } from "../types";
import { loadCatalog } from "./catalog";
import { dropReplacedSearchServers, serverFromCatalog } from "./packages";

/** Crane-local dir on the existing /data bind. photo_generate writes here; pendant avatar/backdrop read source_path from it. */
export const IMAGE_OUTPUT_DIR_DEFAULT = "/data/images";

function seedEnv(envFile: string | null, patch: Record<string, string>): string[] {
  if (!envFile) {
    return [];
  }
  const env = loadEnvFile(envFile);
  const next = { ...env };
  const wrote: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (env[k]?.trim()) {
      continue;
    }
    next[k] = v;
    wrote.push(`${k}=${v}`);
  }
  if (wrote.length) {
    writeEnvFile(envFile, next);
  }
  return wrote;
}

/** Fill catalog download_* when an attached mcp.toml only has name/command. */
export function enrichDownloadUrls(servers: McpServer[], catalog: CatalogEntry[]): McpServer[] {
  return dropReplacedSearchServers(servers).map((s) => {
    const hit = catalog.find((c) => c.name === s.name || c.command === s.command);
    if (s.download_url) {
      return s;
    }
    if (!hit?.download_url) {
      return s;
    }
    return {
      ...s,
      download_url: hit.download_url,
      download_tag: s.download_tag || hit.download_tag,
    };
  });
}

export async function grant(slug: string, name: string): Promise<{ ok: boolean; detail: string; servers: McpServer[] }> {
  const g = await getGantry(slug);
  if (!g?.mcpManifest) {
    return { ok: false, detail: "no mcp_manifest path — add it to gantree.toml", servers: [] };
  }
  const raw = parseMcpToml(readText(g.mcpManifest));
  const servers = dropReplacedSearchServers(raw);
  const scrubbed = servers.length !== raw.length;
  if (name === "google-search") {
    writeText(g.mcpManifest, stringifyMcpToml(servers));
    return { ok: false, detail: "web_search is a crane builtin — not an MCP grant", servers };
  }
  if (servers.some((s) => s.name === name)) {
    if (scrubbed) {
      writeText(g.mcpManifest, stringifyMcpToml(servers));
    }
    return { ok: true, detail: `${name} already granted`, servers };
  }
  const cat = loadCatalog().find((c) => c.name === name);
  const next: McpServer[] = [...servers, cat ? serverFromCatalog(cat) : { name, command: name }];
  writeText(g.mcpManifest, stringifyMcpToml(next));
  if (name === "boards") {
    seedEnv(g.envFile, { BOARDS_AUTHOR: slug });
  }
  const photoDir = name === "image" || name === "pendant"
    ? seedEnv(g.envFile, { IMAGE_OUTPUT_DIR: IMAGE_OUTPUT_DIR_DEFAULT })
    : [];
  const needs = cat?.envKeys?.length ? ` — add ${cat.envKeys.join(", ")} in Secrets` : "";
  const photos = photoDir.length ? ` — ${photoDir.join(", ")} (photo_generate → pendant face/wallpaper)` : "";
  return { ok: true, detail: `granted ${name} — recreate to fetch bins and load it${needs}${photos}`, servers: next };
}

export async function revoke(slug: string, name: string): Promise<{ ok: boolean; detail: string; servers: McpServer[] }> {
  const g = await getGantry(slug);
  if (!g?.mcpManifest) {
    return { ok: false, detail: "no mcp_manifest path — add it to gantree.toml", servers: [] };
  }
  const servers = dropReplacedSearchServers(parseMcpToml(readText(g.mcpManifest))).filter((s) => s.name !== name);
  writeText(g.mcpManifest, stringifyMcpToml(servers));
  return { ok: true, detail: `revoked ${name} — recreate to unload it`, servers };
}
