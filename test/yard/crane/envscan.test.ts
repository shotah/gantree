import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeCraneFiles } from "@/lib/yard/crane/build";
import { cranesHoldingOperator } from "@/lib/yard/crane/envscan";
import { closeYardDb } from "@/lib/yard/door/store";
import { writeEnvFile } from "@/lib/yard/host/envfile";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  process.env.GANTREE_DB = join(root, "gantree.db");
  closeYardDb();
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_TOML;
  delete process.env.GANTREE_DB;
});

describe("cranesHoldingOperator", () => {
  it("lists slugs whose pendant or telegram allowlist still carries the operator", () => {
    const kit = writeCraneFiles({
      slug: "kit",
      channel: "pendant",
      env: { CHANNEL: "pendant", PENDANT_ALLOWED_USERS: "ada@example.com" },
    });
    writeEnvFile(kit.envFile, { CHANNEL: "pendant", PENDANT_ALLOWED_USERS: "ada@example.com" });
    const tryout = writeCraneFiles({
      slug: "tryout",
      channel: "telegram",
      env: { CHANNEL: "telegram", TELEGRAM_ALLOWED_USERS: "99" },
    });
    writeEnvFile(tryout.envFile, { CHANNEL: "telegram", TELEGRAM_ALLOWED_USERS: "99" });
    writeCraneFiles({
      slug: "jules",
      channel: "pendant",
      env: { CHANNEL: "pendant", PENDANT_ALLOWED_USERS: "bob@example.com" },
    });

    expect(
      cranesHoldingOperator({
        email: "ada@example.com",
        channels: { telegram: ["99"], google: [] },
      }),
    ).toEqual([
      { slug: "kit", kind: "pendant" },
      { slug: "tryout", kind: "telegram" },
    ]);
  });
});
