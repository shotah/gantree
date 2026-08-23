import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/tools/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/tools/catalog")>();
  return {
    ...actual,
    loadCatalog: () =>
      actual.PACKAGES.map((p) => ({
        name: p.name,
        command: p.command,
        envKeys: [] as string[],
        blurb: "",
        download_tag: p.downloadTag,
        download_url: p.downloadUrl,
      })),
  };
});

import { buildCrane, writeCraneFiles } from "@/lib/yard/crane/build";
import { DEFAULT_IMAGE } from "@/lib/yard/types";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("writeCraneFiles", () => {
  it("writes an isolated slim crane and inventory", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    const out = writeCraneFiles({ slug: "kit", profile: "slim", channel: "stdio", model: "dummy" });
    expect(readFileSync(join(out.personaDir, "PERSONA.md"), "utf8")).toContain("# kit");
    expect(readFileSync(out.mcpManifest, "utf8")).toContain("math");
    expect(readFileSync(out.envFile, "utf8")).toContain("CHANNEL=stdio");
    expect(readFileSync(join(root, "gantree.toml"), "utf8")).toContain("slug = \"kit\"");
    const compose = readFileSync(join(out.dir, "compose.yml"), "utf8");
    expect(compose).toContain("HOME: /data");
    expect(compose).toContain(`image: ${DEFAULT_IMAGE}`);
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    if (uid != null && gid != null && uid !== 0) {
      expect(compose).toContain(`user: "${uid}:${gid}"`);
    }
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });

  it("seeds a life-cast crane with a custom persona", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    const out = writeCraneFiles({
      slug: "cast",
      profile: "life-cast",
      persona: "# house\n",
      env: { TELEGRAM_BOT_TOKEN: "t" },
    });
    expect(readFileSync(join(out.personaDir, "PERSONA.md"), "utf8")).toContain("# house");
    const mcp = readFileSync(out.mcpManifest, "utf8");
    expect(mcp).toContain("cast");
    expect(mcp).toContain("youtube");
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });
});

describe("buildCrane", () => {
  it("rejects a bad slug before touching disk", async () => {
    const out = await buildCrane({ slug: "1kit" });
    expect(out).toMatchObject({ ok: false, slug: "1kit" });
    expect(out.detail).toMatch(/lowercase/);
  });

  it("refuses life-cast on a cloud yard", async () => {
    const out = await buildCrane({ slug: "kit", yard: "cloud", profile: "life-cast" });
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/home only/);
  });
});
