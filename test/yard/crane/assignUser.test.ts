import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assignCraneUser, detachOperatorFromCranes, refreshAssignedCranes, type CraneUserOp } from "@/lib/yard/crane/assignUser";
import { loadEnvFile, writeEnvFile } from "@/lib/yard/host/envfile";
import { loadGantreeToml, loadTomlTagColors, upsertTomlGantry } from "@/lib/yard/host/files";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_TOML;
});

const ada: CraneUserOp = {
  id: "ada-id",
  name: "ada",
  email: "Ada@Example.com",
  channels: { google: ["118212345678901234567"] },
};

const bob: CraneUserOp = {
  id: "bob-id",
  name: "bob",
  email: "bob@example.com",
  channels: { google: [] },
};

function yard(tags: string[] = ["home"]): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  const env = join(root, ".env");
  writeEnvFile(env, { CHANNEL: "pendant", PENDANT_ALLOWED_USERS: "other@example.com" });
  upsertTomlGantry({ slug: "kit", env_file: env, tags });
  return env;
}

describe("assignCraneUser", () => {
  it("tags the login name, paints it, and adds sub:email to the pendant list", () => {
    const env = yard();
    const result = assignCraneUser("kit", ada);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.user).toBe("ada-id");
    expect(result.tags).toEqual(["home", "ada"]);
    expect(result.pendant).toBe("added");
    expect(result.detail).toMatch(/tagged ada/);
    expect(result.detail).toMatch(/recreate to apply/);
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBe("ada-id");
    expect(loadTomlTagColors().ada).toBe("sky");
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toBe("other@example.com,118212345678901234567:ada@example.com");
  });

  it("swaps the board tag and keeps the previous pendant email", () => {
    const env = yard();
    assignCraneUser("kit", ada);
    const result = assignCraneUser("kit", bob, { previousName: "ada" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.tags).toEqual(["home", "bob"]);
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBe("bob-id");
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toContain("ada@example.com");
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toContain("bob@example.com");
  });

  it("clears the user and the tag and leaves the allowlist", () => {
    const env = yard();
    assignCraneUser("kit", ada);
    const result = assignCraneUser("kit", null, { previousName: "ada" });
    expect(result).toMatchObject({ ok: true, user: null, tags: ["home"], pendant: "unchanged" });
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBeUndefined();
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toContain("ada@example.com");
  });

  it("still assigns when the profile has no email or Google sub", () => {
    yard();
    const result = assignCraneUser("kit", { ...ada, email: "", channels: { google: [] } });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pendant).toBe("no-email");
    expect(result.tags).toContain("ada");
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBe("ada-id");
  });

  it("skips a login name that cannot be a tag", () => {
    yard();
    const result = assignCraneUser("kit", { ...bob, name: "1bob" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.tags).toEqual(["home"]);
    expect(result.detail).toMatch(/not a board tag/);
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBe("bob-id");
  });

  it("keeps the user when the tag list is full", () => {
    yard(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const result = assignCraneUser("kit", ada);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.tags).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(result.detail).toMatch(/at most 8 tags/);
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBe("ada-id");
  });

  it("refuses a crane that is not in inventory", () => {
    yard();
    expect(assignCraneUser("missing", ada)).toMatchObject({ ok: false });
  });

  it("refreshes the pendant entry after an email change and drops the tag when the operator is removed", () => {
    const env = yard();
    assignCraneUser("kit", ada);
    refreshAssignedCranes({ ...ada, email: "ada@yard.test" }, "ada");
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toContain("118212345678901234567:ada@yard.test");
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).not.toContain("ada@example.com");
    expect(loadGantreeToml()?.gantry?.[0]?.tags).toEqual(["home", "ada"]);
    detachOperatorFromCranes(ada);
    expect(loadGantreeToml()?.gantry?.[0]?.user).toBeUndefined();
    expect(loadGantreeToml()?.gantry?.[0]?.tags).toEqual(["home"]);
    expect(loadEnvFile(env).PENDANT_ALLOWED_USERS).toContain("ada@yard.test");
  });
});
