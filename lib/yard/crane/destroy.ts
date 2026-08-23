import { existsSync, rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { unassignCrane } from "../door";
import { docker, inspectByName } from "../host/docker";
import { removeTomlGantry, yardRoot } from "../host/files";
import { forgetCrane } from "../observe/stats";
import { craneDir } from "./build";
import { getGantry, kickYardDocker, resetYardDockerCache } from "./inventory";

export type DestroyOpts = {
  removeFiles?: boolean;
};

export type DestroyResult = {
  ok: boolean;
  detail: string;
  slug: string;
  removed: { container: boolean; inventory: boolean; files: boolean };
};

export async function destroyCrane(slug: string, opts: DestroyOpts = {}): Promise<DestroyResult> {
  const g = await getGantry(slug);
  if (!g) {
    return {
      ok: false,
      detail: `unknown gantry ${slug}`,
      slug,
      removed: { container: false, inventory: false, files: false },
    };
  }

  let container = false;
  try {
    for (const name of unique([g.containerName, g.slug, g.containerId])) {
      if (await dropNamedContainer(name)) {
        container = true;
      }
    }
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      slug,
      removed: { container, inventory: false, files: false },
    };
  }

  const inventory = removeTomlGantry(slug);
  unassignCrane(slug);
  forgetCrane(slug);
  resetYardDockerCache();
  void kickYardDocker();

  const files = opts.removeFiles === true ? dropCraneFiles(slug) : false;
  const bits = [
    container ? "container removed" : "no container",
    inventory ? "dropped from inventory" : "not in inventory",
    opts.removeFiles ? (files ? "files deleted" : "no files") : "files kept",
  ];
  return {
    ok: true,
    detail: `destroyed ${slug}: ${bits.join("; ")}`,
    slug,
    removed: { container, inventory, files },
  };
}

function unique(names: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push(name);
  }
  return out;
}

async function dropNamedContainer(name: string): Promise<boolean> {
  const existing = await inspectByName(name);
  if (!existing) {
    return false;
  }
  const c = docker().getContainer(existing.info.Id);
  try {
    await c.stop({ t: 5 });
  } catch {
    /* already stopped */
  }
  await c.remove({ force: true });
  return true;
}

/** Only `gantries/<slug>/` under the yard root — never a custom path outside it. */
export function dropCraneFiles(slug: string): boolean {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(slug)) {
    return false;
  }
  const gantries = resolve(yardRoot(), "gantries");
  const dir = craneDir(slug);
  const rel = relative(gantries, dir);
  if (rel !== slug || rel.startsWith("..") || rel.includes(sep)) {
    return false;
  }
  if (!existsSync(dir)) {
    return false;
  }
  rmSync(dir, { recursive: true, force: true });
  return true;
}
