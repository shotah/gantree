import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeCraneFiles } from "./build";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("writeCraneFiles", () => {
  it("writes an isolated slim crane and inventory", () => {
    const root = mkdtempSync(join(import.meta.dirname, "../../.tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    const out = writeCraneFiles({ slug: "kit", profile: "slim", channel: "stdio", model: "dummy" });
    expect(readFileSync(join(out.personaDir, "PERSONA.md"), "utf8")).toContain("# kit");
    expect(readFileSync(out.mcpManifest, "utf8")).toContain("math");
    expect(readFileSync(out.envFile, "utf8")).toContain("CHANNEL=stdio");
    expect(readFileSync(join(root, "gantree.toml"), "utf8")).toContain("slug = \"kit\"");
    const compose = readFileSync(join(out.dir, "compose.yml"), "utf8");
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    if (uid != null && gid != null && uid !== 0) {
      expect(compose).toContain(`user: "${uid}:${gid}"`);
    }
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });
});
