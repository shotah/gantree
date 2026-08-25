import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

import { buildCrane, dropStaleDoctorSnapshot, writeCraneFiles } from "@/lib/yard/crane/build";
import { loadGantreeToml } from "@/lib/yard/host/files";
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
    const persona = readFileSync(join(out.personaDir, "PERSONA.md"), "utf8");
    const self = readFileSync(join(out.personaDir, "SELF.md"), "utf8");
    expect(persona).toContain("# PERSONA.md");
    expect(persona).toContain("**Name:** Kit");
    expect(persona).toContain("## About you");
    expect(persona).toContain("## Harness tools");
    expect(persona).toContain("Prefer parallel tool calls");
    expect(persona).toContain("Independent lookups");
    expect(persona).toContain("pref/hours");
    expect(persona).toContain("mcp_enable");
    expect(persona).toContain("## Memory hygiene");
    expect(persona).not.toContain("A long-horizon personal agent");
    expect(self).toContain("Who You Are Becoming");
    expect(self).toContain("north-star");
    expect(persona).not.toBe(self);
    expect(readFileSync(out.mcpManifest, "utf8")).toContain("math");
    expect(readFileSync(out.mcpManifest, "utf8")).toContain("github.com/shotah/mcp-gemini-search");
    expect(readFileSync(out.mcpManifest, "utf8")).not.toMatch(/zchee/);
    expect(readFileSync(out.envFile, "utf8")).toContain("CHANNEL=stdio");
    expect(readFileSync(join(root, "gantree.toml"), "utf8")).toContain("slug = \"kit\"");
    const inventory = loadGantreeToml()?.gantry?.[0];
    expect(inventory).toMatchObject({
      slug: "kit",
      data_dir: out.dataDir,
      persona_dir: out.personaDir,
      mcp_manifest: out.mcpManifest,
      env_file: out.envFile,
    });
    expect(inventory?.data_dir?.startsWith(root)).toBe(true);
    expect(inventory?.data_dir).not.toMatch(/^\.\//);
    const compose = readFileSync(join(out.dir, "compose.yml"), "utf8");
    expect(compose).toContain("HOME: /data");
    expect(compose).toContain(`image: ${DEFAULT_IMAGE}`);
    expect(compose).not.toMatch(/^\s+ports:/m);
    expect(compose).toContain("# No ports — outbound chat only.");
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
    expect(readFileSync(join(out.personaDir, "SELF.md"), "utf8")).toContain("Who You Are Becoming");
    expect(readFileSync(join(out.personaDir, "SELF.md"), "utf8")).not.toContain("# house");
    const mcp = readFileSync(out.mcpManifest, "utf8");
    expect(mcp).toContain("cast");
    expect(mcp).toContain("youtube");
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });

  it("keeps two slugs in isolated directories and omits cast on a cloud life-cast seed", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    const kit = writeCraneFiles({ slug: "kit", profile: "slim" });
    const jules = writeCraneFiles({ slug: "jules", profile: "life" });
    expect(kit.dir).not.toBe(jules.dir);
    expect(readFileSync(join(kit.personaDir, "PERSONA.md"), "utf8")).toContain("**Name:** Kit");
    expect(existsSync(join(kit.personaDir, "SELF.md"))).toBe(true);
    expect(readFileSync(join(jules.personaDir, "PERSONA.md"), "utf8")).toContain("**Name:** Jules");
    expect(existsSync(join(jules.personaDir, "SELF.md"))).toBe(true);
    expect(readFileSync(kit.mcpManifest, "utf8")).not.toContain("google-mcp");
    expect(readFileSync(jules.mcpManifest, "utf8")).toContain("google-mcp");
    expect(readFileSync(jules.mcpManifest, "utf8")).toContain("maps");

    const cloud = writeCraneFiles({ slug: "tryout", yard: "cloud", profile: "life-cast" });
    const cloudMcp = readFileSync(cloud.mcpManifest, "utf8");
    expect(cloudMcp).toContain("google-mcp");
    expect(cloudMcp).not.toContain("mcp-beam");
    expect(cloudMcp).not.toContain("youtube");
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });

  it("does not overwrite PERSONA.md or SELF.md on rebuild", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    const first = writeCraneFiles({ slug: "kit" });
    writeFileSync(join(first.personaDir, "PERSONA.md"), "# kit\n\nA long-horizon personal agent.\n");
    writeFileSync(join(first.personaDir, "SELF.md"), "kept by /new\n");
    writeCraneFiles({ slug: "kit", persona: "# rebuilt\n" });
    expect(readFileSync(join(first.personaDir, "PERSONA.md"), "utf8")).toBe("# kit\n\nA long-horizon personal agent.\n");
    expect(readFileSync(join(first.personaDir, "SELF.md"), "utf8")).toBe("kept by /new\n");
    expect(loadGantreeToml()?.gantry?.[0]?.data_dir).toBe(first.dataDir);
    delete process.env.GANTREE_ROOT;
    delete process.env.GANTREE_TOML;
  });
});

describe("dropStaleDoctorSnapshot", () => {
  it("removes a previous boot skip list and ignores a missing file", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const snap = join(root, "doctor.json");
    writeFileSync(snap, '{"skipped":2}\n');
    dropStaleDoctorSnapshot(root);
    expect(existsSync(snap)).toBe(false);
    expect(() => dropStaleDoctorSnapshot(root)).not.toThrow();
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
