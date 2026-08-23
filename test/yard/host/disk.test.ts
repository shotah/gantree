import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dirBytes } from "@/lib/yard/host/disk";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("dirBytes", () => {
  it("sums files in a data dir", async () => {
    const root = mkdtempSync(join(tmpdir(), "gantree-du-"));
    dirs.push(root);
    mkdirSync(join(root, "nested"));
    writeFileSync(join(root, "a.bin"), Buffer.alloc(100));
    writeFileSync(join(root, "nested", "b.bin"), Buffer.alloc(40));
    const n = await dirBytes(root);
    expect(n).toBeGreaterThanOrEqual(140);
  });

  it("returns null when the path is missing", async () => {
    expect(await dirBytes(join(tmpdir(), "gantree-du-missing-xyz"))).toBeNull();
  });
});
