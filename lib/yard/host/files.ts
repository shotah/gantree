import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "smol-toml";
import type { McpServer } from "../types";
import { copyAvatarTo } from "./avatar";

export type TomlGantry = {
  slug: string;
  container?: string;
  data_dir?: string;
  persona_dir?: string;
  mcp_manifest?: string;
  env_file?: string;
};

export type GantreeToml = {
  yard?: string;
  gantry?: TomlGantry[];
};

export function yardRoot(): string {
  return resolve(process.env.GANTREE_ROOT || process.cwd());
}

export function tomlPath(): string {
  return resolve(process.env.GANTREE_TOML || resolve(yardRoot(), "gantree.toml"));
}

export function loadGantreeToml(): GantreeToml | null {
  const p = tomlPath();
  if (!existsSync(p)) {
    return null;
  }
  const raw = parse(readFileSync(p, "utf8")) as GantreeToml;
  return raw;
}

export function saveGantreeToml(doc: GantreeToml): void {
  const header = `# Inventory — no secrets. Edited by gantree.\n`;
  writeText(tomlPath(), `${header}\n${stringify(doc)}\n`);
}

export function upsertTomlGantry(row: TomlGantry, yard = "home"): void {
  const doc = loadGantreeToml() ?? { yard, gantry: [] };
  doc.yard = doc.yard || yard;
  const list = doc.gantry ?? [];
  const i = list.findIndex((g) => g.slug === row.slug);
  if (i >= 0) {
    list[i] = { ...list[i], ...row };
  } else {
    list.push(row);
  }
  doc.gantry = list;
  saveGantreeToml(doc);
}

export function envKeyNames(envFile: string | null): { keys: string[]; valuesPresent: Record<string, boolean> } {
  const valuesPresent: Record<string, boolean> = {};
  if (!envFile || !existsSync(envFile)) {
    return { keys: [], valuesPresent };
  }
  const keys: string[] = [];
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const k = t.slice(0, eq);
    const v = t.slice(eq + 1);
    keys.push(k);
    valuesPresent[k] = v.trim().length > 0;
  }
  return { keys, valuesPresent };
}

export function readText(path: string | null): string | null {
  if (!path || !existsSync(path)) {
    return null;
  }
  return readFileSync(path, "utf8");
}

export function writeText(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

export function parseMcpToml(text: string | null): McpServer[] {
  if (!text) {
    return [];
  }
  const raw = parse(text) as { server?: McpServer | McpServer[] };
  if (!raw.server) {
    return [];
  }
  return Array.isArray(raw.server) ? raw.server : [raw.server];
}

export function stringifyMcpToml(servers: McpServer[]): string {
  const header = `# MCP server manifest — listed = granted.\n# Edited by gantree. Hand-edits are the same source of truth.\n`;
  if (servers.length === 0) {
    return `${header}\n# (no servers granted)\n`;
  }
  return `${header}\n${stringify({ server: servers })}\n`;
}

export function backupFiles(dataDir: string | null, personaDir: string | null): string | null {
  if (!dataDir && !personaDir) {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = resolve(yardRoot(), "backups", stamp);
  mkdirSync(dest, { recursive: true });
  const db = dataDir ? resolve(dataDir, "gantry.db") : null;
  const self = personaDir ? resolve(personaDir, "SELF.md") : null;
  if (db && existsSync(db)) {
    copyFileSync(db, resolve(dest, "gantry.db"));
  }
  if (self && existsSync(self)) {
    copyFileSync(self, resolve(dest, "SELF.md"));
  }
  copyAvatarTo(personaDir, dest);
  return dest;
}
