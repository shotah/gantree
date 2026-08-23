import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeYardDb, inspectYardDb, yardDb } from "@/lib/yard/door/store";

const dirs: string[] = [];

beforeEach(() => {
  closeYardDb();
  const root = mkdtempSync(join(tmpdir(), "gantree-inspect-"));
  dirs.push(root);
  process.env.GANTREE_DB = join(root, "gantree.db");
});

afterEach(() => {
  closeYardDb();
  delete process.env.GANTREE_DB;
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("inspectYardDb", () => {
  it("lists table counts without reading operator hashes", () => {
    yardDb();
    const snap = inspectYardDb();
    expect(snap.path).toContain("gantree.db");
    expect(snap.tables.map((t) => t.name)).toContain("sample_machine");
    expect(snap.tables.map((t) => t.name)).toContain("operator");
    expect(snap.tables.find((t) => t.name === "operator")?.rows).toBe(0);
  });
});
