import { loadCatalog } from "./catalog";
import { parseMcpToml, readText, stringifyMcpToml, writeText } from "./files";
import { getGantry } from "./inventory";
import type { McpServer } from "./types";

export async function grant(slug: string, name: string): Promise<{ ok: boolean; detail: string; servers: McpServer[] }> {
  const g = await getGantry(slug);
  if (!g?.mcpManifest) {
    return { ok: false, detail: "no mcp_manifest path — add it to gantree.toml", servers: [] };
  }
  const servers = parseMcpToml(readText(g.mcpManifest));
  if (servers.some((s) => s.name === name)) {
    return { ok: true, detail: `${name} already granted`, servers };
  }
  const cat = loadCatalog().find((c) => c.name === name);
  const next: McpServer[] = [
    ...servers,
    cat
      ? {
          name: cat.name,
          command: cat.command,
          args: cat.args,
          auth_args: cat.auth_args,
          download_tag: cat.download_tag,
          download_url: cat.download_url,
        }
      : { name, command: name },
  ];
  writeText(g.mcpManifest, stringifyMcpToml(next));
  return { ok: true, detail: `granted ${name} — recreate to load it`, servers: next };
}

export async function revoke(slug: string, name: string): Promise<{ ok: boolean; detail: string; servers: McpServer[] }> {
  const g = await getGantry(slug);
  if (!g?.mcpManifest) {
    return { ok: false, detail: "no mcp_manifest path — add it to gantree.toml", servers: [] };
  }
  const servers = parseMcpToml(readText(g.mcpManifest)).filter((s) => s.name !== name);
  writeText(g.mcpManifest, stringifyMcpToml(servers));
  return { ok: true, detail: `revoked ${name} — recreate to unload it`, servers };
}
