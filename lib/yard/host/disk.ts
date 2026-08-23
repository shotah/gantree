import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** `du -sb` of a crane data dir. Walks if GNU du is missing. Null on error. */
export async function dirBytes(root: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("du", ["-sb", root], { timeout: 20_000 });
    const n = Number.parseInt(String(stdout).trim().split(/\s+/)[0] ?? "", 10);
    if (Number.isFinite(n) && n >= 0) {
      return n;
    }
  } catch {
    /* walk */
  }
  try {
    return await walkBytes(root);
  } catch {
    return null;
  }
}

async function walkBytes(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) {
      total += await walkBytes(p);
    } else if (e.isFile()) {
      total += (await stat(p)).size;
    }
  }
  return total;
}
