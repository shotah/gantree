import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { copyAvatarTo } from "../host/avatar";
import { pullImage } from "../host/docker";
import { loadEnvFile } from "../host/envfile";
import { readText, setTomlGantryTags } from "../host/files";
import { loadObservePrefs } from "../observe/prefs";
import { craneDir, createOrReplaceContainer, writeCraneFiles } from "./build";
import { getGantry } from "./inventory";
import { slugOk } from "./slug";

export type CloneParts = {
  slug: string;
  settings: boolean;
  persona: boolean;
  database: boolean;
};

const DB_SIDECARS = ["gantry.db", "gantry.db-wal", "gantry.db-shm"] as const;

export function copyGantryDb(srcDir: string, destDir: string): boolean {
  const src = resolve(srcDir, "gantry.db");
  if (!existsSync(src)) {
    return false;
  }
  const dest = resolve(destDir, "gantry.db");
  try {
    snapshotSqlite(src, dest);
    return existsSync(dest);
  } catch {
    try {
      unlinkSync(dest);
    } catch {
      /* incomplete VACUUM INTO */
    }
    for (const name of DB_SIDECARS) {
      const from = resolve(srcDir, name);
      if (existsSync(from)) {
        copyFileSync(from, resolve(destDir, name));
      }
    }
    return existsSync(dest);
  }
}

function snapshotSqlite(src: string, dest: string): void {
  const db = new DatabaseSync(src, { readOnly: true, timeout: 5000 });
  try {
    db.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }
}

export function copyPersonaFiles(from: string, to: string): void {
  for (const name of ["PERSONA.md", "SELF.md"] as const) {
    const src = resolve(from, name);
    if (existsSync(src)) {
      copyFileSync(src, resolve(to, name));
    }
  }
  copyAvatarTo(from, to);
}

function composeImage(slug: string): string | null {
  const text = readText(resolve(craneDir(slug), "compose.yml"));
  const m = text?.match(/^\s+image:\s+(\S+)/m);
  return m?.[1] ?? null;
}

function partsList(opts: CloneParts): string[] {
  const out: string[] = [];
  if (opts.settings) {
    out.push("settings");
  }
  if (opts.persona) {
    out.push("persona");
  }
  if (opts.database) {
    out.push("database");
  }
  return out;
}

export async function cloneCrane(
  sourceSlug: string,
  opts: CloneParts,
): Promise<{ ok: boolean; detail: string; slug: string }> {
  const dest = opts.slug.trim().toLowerCase();
  if (!slugOk(dest)) {
    return { ok: false, detail: "slug must be lowercase letters, numbers, dashes", slug: dest };
  }
  if (dest === sourceSlug) {
    return { ok: false, detail: "clone slug must differ from the source", slug: dest };
  }
  if (!opts.settings && !opts.persona && !opts.database) {
    return { ok: false, detail: "pick settings, persona files, or database", slug: dest };
  }
  const source = await getGantry(sourceSlug);
  if (!source) {
    return { ok: false, detail: `unknown gantry ${sourceSlug}`, slug: dest };
  }
  if (await getGantry(dest)) {
    return { ok: false, detail: `crane ${dest} already exists`, slug: dest };
  }
  if (existsSync(craneDir(dest))) {
    return { ok: false, detail: `gantries/${dest} already exists`, slug: dest };
  }

  const env = opts.settings ? loadEnvFile(source.envFile) : {};
  const image = opts.settings
    ? source.image || composeImage(sourceSlug) || loadObservePrefs().defaultImage
    : loadObservePrefs().defaultImage;
  const files = writeCraneFiles({
    slug: dest,
    image,
    model: opts.settings ? env.LLM_MODEL || undefined : undefined,
    channel: opts.settings ? env.CHANNEL || undefined : undefined,
    env: opts.settings ? env : undefined,
  });
  if (opts.settings && source.mcpManifest && existsSync(source.mcpManifest)) {
    copyFileSync(source.mcpManifest, files.mcpManifest);
  }
  if (opts.settings && source.envFile && existsSync(source.envFile)) {
    copyFileSync(source.envFile, files.envFile);
  }
  if (opts.persona && source.personaDir) {
    copyPersonaFiles(source.personaDir, files.personaDir);
  }
  if (opts.settings && (source.tags ?? []).length) {
    setTomlGantryTags(dest, source.tags ?? []);
  }
  if (opts.database && source.dataDir) {
    copyGantryDb(source.dataDir, files.dataDir);
  }

  const copied = partsList(opts).join(", ");
  try {
    await pullImage(image);
  } catch {
    /* local image may already exist */
  }
  try {
    const created = await createOrReplaceContainer({
      slug: dest,
      image,
      env: loadEnvFile(files.envFile),
      personaDir: files.personaDir,
      dataDir: files.dataDir,
      mcpManifest: files.mcpManifest,
    });
    return { ok: true, detail: `cloned ${sourceSlug} → ${dest} (${copied}); ${created.detail}`, slug: dest };
  } catch (err) {
    return {
      ok: false,
      detail: `wrote gantries/${dest}; ${err instanceof Error ? err.message : String(err)}`,
      slug: dest,
    };
  }
}
