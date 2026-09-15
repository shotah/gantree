import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeYardDb } from "@/lib/yard/door/store";
import { githubTokenIsSet, loadYardGithubToken, saveYardGithubToken } from "@/lib/yard/host/github";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "gantree-github-"));
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

describe("yard GitHub PAT", () => {
  it("round-trips in sqlite and keeps a blank save", () => {
    expect(loadYardGithubToken()).toBe("");
    expect(githubTokenIsSet({})).toBe(false);
    expect(saveYardGithubToken("  ghp_yard  ")).toBe(true);
    expect(loadYardGithubToken()).toBe("ghp_yard");
    expect(saveYardGithubToken("   ")).toBe(true);
    expect(loadYardGithubToken()).toBe("ghp_yard");
    expect(githubTokenIsSet({})).toBe(true);
  });
});
