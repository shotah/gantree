import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  backupFiles,
  boardsDir,
  ensureBoardsDir,
  envKeyNames,
  loadGantreeToml,
  mergeTomlTagColors,
  parseMcpToml,
  stringifyMcpToml,
  upsertTomlGantry,
  removeTomlGantry,
  setTomlGantryTags,
  writeText,
} from "@/lib/yard/host/files";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_TOML;
});

describe("mcp toml", () => {
  it("round-trips a grant list", () => {
    const text = stringifyMcpToml([
      { name: "math", command: "mcp-go-math" },
      { name: "google", command: "google-mcp", args: ["--preset", "everyday"], download_tag: "latest", download_url: "https://example.com/{tag}.tgz" },
    ]);
    const servers = parseMcpToml(text);
    expect(servers.map((s) => s.name)).toEqual(["math", "google"]);
    expect(servers[1]?.args).toEqual(["--preset", "everyday"]);
    expect(servers[1]?.download_url).toContain("{tag}");
  });

  it("round-trips env_keys so Secrets can list them", () => {
    const text = stringifyMcpToml([
      { name: "maps", command: "google-maps-mcp", env_keys: ["GOOGLE_MAPS_API_KEY"] },
    ]);
    expect(text).toContain("GOOGLE_MAPS_API_KEY");
    expect(parseMcpToml(text)[0]?.env_keys).toEqual(["GOOGLE_MAPS_API_KEY"]);
  });

  it("treats empty as no grant", () => {
    expect(parseMcpToml(null)).toEqual([]);
    expect(parseMcpToml("# none\n")).toEqual([]);
  });
});

describe("inventory toml", () => {
  it("round-trips upsert into gantree.toml", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    expect(loadGantreeToml()).toBeNull();
    upsertTomlGantry({ slug: "kit", container: "kit" });
    upsertTomlGantry({ slug: "kit", data_dir: "./gantries/kit/data" }, "home");
    upsertTomlGantry({ slug: "tryout" });
    const doc = loadGantreeToml();
    expect(doc?.yard).toBe("home");
    expect(doc?.gantry?.map((g) => g.slug)).toEqual(["kit", "tryout"]);
    expect(doc?.gantry?.[0]?.data_dir).toContain("kit");
  });

  it("drops one slug and leaves the rest", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    upsertTomlGantry({ slug: "kit" });
    upsertTomlGantry({ slug: "tryout" });
    expect(removeTomlGantry("kit")).toBe(true);
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["tryout"]);
    expect(removeTomlGantry("kit")).toBe(false);
    expect(removeTomlGantry("tryout")).toBe(true);
    expect(loadGantreeToml()?.gantry).toEqual([]);
  });

  it("round-trips crane tags and yard-wide hues", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "gantree.toml");
    expect(mergeTomlTagColors({ home: "red" })).toBe(false);
    expect(setTomlGantryTags("kit", ["home"])).toBe(false);
    upsertTomlGantry({ slug: "kit" });
    expect(setTomlGantryTags("kit", ["home", "guest"])).toBe(true);
    expect(setTomlGantryTags("missing", ["home"])).toBe(false);
    expect(mergeTomlTagColors({ home: "red" })).toBe(true);
    expect(mergeTomlTagColors({ guest: "green" })).toBe(true);
    const doc = loadGantreeToml();
    expect(doc?.gantry?.[0]?.tags).toEqual(["home", "guest"]);
    expect(doc?.tag_color).toEqual({ home: "red", guest: "green" });
    expect(setTomlGantryTags("kit", [])).toBe(true);
    expect(loadGantreeToml()?.gantry?.[0]?.tags).toBeUndefined();
    expect(loadGantreeToml()?.tag_color).toEqual({ home: "red", guest: "green" });
  });
});

describe("envKeyNames and writeText", () => {
  it("skips comments and empty values", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const env = join(root, ".env");
    writeText(env, "# hi\n\nCHANNEL=telegram\nEMPTY=\nNOEQ\n=bad\n");
    const names = envKeyNames(env);
    expect(names.keys).toEqual(["CHANNEL", "EMPTY"]);
    expect(names.valuesPresent).toEqual({ CHANNEL: true, EMPTY: false });
    expect(envKeyNames(null).keys).toEqual([]);
  });
});

describe("boards dir", () => {
  it("is yardRoot/boards and world-writable after ensure", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    expect(boardsDir()).toBe(join(root, "boards"));
    expect(existsSync(boardsDir())).toBe(false);
    expect(ensureBoardsDir()).toBe(join(root, "boards"));
    expect(existsSync(boardsDir())).toBe(true);
  });
});

describe("backupFiles", () => {
  it("returns null without dirs", () => {
    expect(backupFiles(null, null)).toBeNull();
  });

  it("copies SELF.md and avatar.jpg", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    const persona = join(root, "persona");
    mkdirSync(persona);
    writeFileSync(join(persona, "SELF.md"), "me\n");
    const jpeg = new Uint8Array(128);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    writeFileSync(join(persona, "avatar.jpg"), jpeg);
    const dest = backupFiles(null, persona);
    expect(dest).toBeTruthy();
    expect(existsSync(join(dest!, "SELF.md"))).toBe(true);
    expect(existsSync(join(dest!, "avatar.jpg"))).toBe(true);
  });

  it("copies gantry.db from data/", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    const data = join(root, "data");
    mkdirSync(data);
    writeFileSync(join(data, "gantry.db"), "db");
    const dest = backupFiles(data, null);
    expect(existsSync(join(dest!, "gantry.db"))).toBe(true);
  });

  it("never copies .env into the backup", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    const data = join(root, "data");
    const persona = join(root, "persona");
    mkdirSync(data);
    mkdirSync(persona);
    writeFileSync(join(data, "gantry.db"), "db");
    writeFileSync(join(data, ".env"), "TELEGRAM_BOT_TOKEN=secret\n");
    writeFileSync(join(persona, ".env"), "LLM_API_KEY=also-secret\n");
    writeFileSync(join(persona, "SELF.md"), "me\n");
    const dest = backupFiles(data, persona);
    expect(existsSync(join(dest!, "gantry.db"))).toBe(true);
    expect(existsSync(join(dest!, "SELF.md"))).toBe(true);
    expect(existsSync(join(dest!, ".env"))).toBe(false);
  });
});
