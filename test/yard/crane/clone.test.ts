import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    listGantryContainers: vi.fn(),
    inspectByName: vi.fn(),
    docker: vi.fn(),
    pullImage: vi.fn(),
    containerLogsBuffer: vi.fn(),
    execStatus: vi.fn(),
  };
});

vi.mock("@/lib/yard/crane/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/crane/build")>();
  return { ...actual, createOrReplaceContainer: vi.fn() };
});

import { POST as cloneGantry } from "@/app/api/gantries/[slug]/clone/route";
import { GET as getGantry } from "@/app/api/gantries/[slug]/route";
import { createOrReplaceContainer, writeCraneFiles } from "@/lib/yard/crane/build";
import { cloneCrane, copyGantryDb } from "@/lib/yard/crane/clone";
import { resetYardDockerCache } from "@/lib/yard/crane/inventory";
import { suggestCloneSlug } from "@/lib/yard/crane/slug";
import { addOperator, listYardEvents, loginOperator, SESSION_COOKIE, setupOperator } from "@/lib/yard/door";
import { closeYardDb } from "@/lib/yard/door/store";
import { listGantryContainers, pullImage } from "@/lib/yard/host/docker";
import { loadEnvFile } from "@/lib/yard/host/envfile";
import { loadGantreeToml, mergeTomlTagColors, setTomlGantryTags } from "@/lib/yard/host/files";

const dirs: string[] = [];
const pass = "a-long-enough-pass";

beforeEach(() => {
  resetYardDockerCache();
  vi.mocked(listGantryContainers).mockReset();
  vi.mocked(listGantryContainers).mockResolvedValue([]);
  vi.mocked(pullImage).mockReset();
  vi.mocked(pullImage).mockResolvedValue(undefined);
  vi.mocked(createOrReplaceContainer).mockReset();
  vi.mocked(createOrReplaceContainer).mockResolvedValue({ id: "n", detail: "built crane kit-copy" });
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

function seedJules() {
  const jules = writeCraneFiles({
    slug: "jules",
    profile: "life",
    persona: "# Jules\n\nI am Jules.\n",
    env: {
      LLM_MODEL: "gemini-3.6-flash",
      CHANNEL: "telegram",
      LLM_API_KEY: "sk-jules",
      TELEGRAM_BOT_TOKEN: "123:jules-bot",
    },
  });
  writeFileSync(join(jules.personaDir, "SELF.md"), "# distilled jules\n");
  writeFileSync(join(jules.personaDir, "avatar.jpg"), "jpeg-bytes");
  const db = new DatabaseSync(join(jules.dataDir, "gantry.db"));
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("CREATE TABLE mem (k TEXT, v TEXT); INSERT INTO mem VALUES ('who', 'jules');");
  db.close();
  setTomlGantryTags("jules", ["house"]);
  return jules;
}

describe("suggestCloneSlug", () => {
  it("appends -copy and stays within 32 characters", () => {
    expect(suggestCloneSlug("kit")).toBe("kit-copy");
    expect(suggestCloneSlug("a".repeat(32)).length).toBe(32);
    expect(suggestCloneSlug("a".repeat(32)).endsWith("-copy")).toBe(true);
  });
});

describe("copyGantryDb", () => {
  it("snapshots a WAL database into a single dest file", () => {
    const src = join(dirs[0]!, "src");
    const dest = join(dirs[0]!, "dest");
    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    const db = new DatabaseSync(join(src, "gantry.db"));
    db.exec("PRAGMA journal_mode=WAL;");
    db.exec("CREATE TABLE mem (k TEXT); INSERT INTO mem VALUES ('ok');");
    db.close();
    expect(copyGantryDb(src, dest)).toBe(true);
    const copied = new DatabaseSync(join(dest, "gantry.db"), { readOnly: true });
    expect(copied.prepare("SELECT k FROM mem").get()).toEqual({ k: "ok" });
    copied.close();
  });

  it("returns false when gantry.db is missing", () => {
    expect(copyGantryDb(dirs[0]!, dirs[0]!)).toBe(false);
  });
});

describe("cloneCrane", () => {
  it("rejects a bad slug, the same slug, nothing selected, and an unknown source", async () => {
    expect(await cloneCrane("jules", { slug: "1x", settings: true, persona: false, database: false })).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/lowercase/),
    });
    seedJules();
    expect(await cloneCrane("jules", { slug: "jules", settings: true, persona: false, database: false })).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/differ/),
    });
    expect(await cloneCrane("jules", { slug: "try", settings: false, persona: false, database: false })).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/pick settings/),
    });
    expect(await cloneCrane("missing", { slug: "try", settings: true, persona: false, database: false })).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/unknown/),
    });
  });

  it("copies settings by default shape: env, mcp grants, image, tags — not persona or memories", async () => {
    seedJules();
    mergeTomlTagColors({ house: "green" });
    const out = await cloneCrane("jules", { slug: "kit-copy", settings: true, persona: false, database: false });
    expect(out.ok).toBe(true);
    expect(out.detail).toMatch(/settings/);
    expect(out.detail).not.toMatch(/persona/);
    const destDir = join(dirs[0]!, "gantries", "kit-copy");
    expect(loadEnvFile(join(destDir, ".env")).LLM_API_KEY).toBe("sk-jules");
    expect(loadEnvFile(join(destDir, ".env")).TELEGRAM_BOT_TOKEN).toBe("123:jules-bot");
    expect(readFileSync(join(destDir, "mcp.toml"), "utf8")).toContain("google-mcp");
    expect(readFileSync(join(destDir, "compose.yml"), "utf8")).toContain(`image:`);
    expect(readFileSync(join(destDir, "persona", "PERSONA.md"), "utf8")).toContain("**Name:** Kit-copy");
    expect(readFileSync(join(destDir, "persona", "PERSONA.md"), "utf8")).not.toContain("I am Jules");
    expect(existsSync(join(destDir, "data", "gantry.db"))).toBe(false);
    expect(existsSync(join(destDir, "persona", "avatar.jpg"))).toBe(false);
    const doc = loadGantreeToml();
    expect(doc?.gantry?.find((g) => g.slug === "kit-copy")?.tags).toEqual(["house"]);
    expect(doc?.tag_color).toEqual({ house: "green" });
    expect(createOrReplaceContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "kit-copy",
        env: expect.objectContaining({ LLM_API_KEY: "sk-jules" }),
      }),
    );
  });

  it("copies persona files without taking keys or the database", async () => {
    seedJules();
    const out = await cloneCrane("jules", { slug: "tryout", settings: false, persona: true, database: false });
    expect(out.ok).toBe(true);
    const destDir = join(dirs[0]!, "gantries", "tryout");
    expect(readFileSync(join(destDir, "persona", "PERSONA.md"), "utf8")).toContain("I am Jules");
    expect(readFileSync(join(destDir, "persona", "SELF.md"), "utf8")).toBe("# distilled jules\n");
    expect(readFileSync(join(destDir, "persona", "avatar.jpg"), "utf8")).toBe("jpeg-bytes");
    expect(loadEnvFile(join(destDir, ".env")).LLM_API_KEY).toBeUndefined();
    expect(readFileSync(join(destDir, "mcp.toml"), "utf8")).not.toContain("google-mcp");
    expect(existsSync(join(destDir, "data", "gantry.db"))).toBe(false);
    expect(loadGantreeToml()?.gantry?.find((g) => g.slug === "tryout")?.tags).toBeUndefined();
  });

  it("copies persona and database without settings for troubleshooting", async () => {
    seedJules();
    const out = await cloneCrane("jules", { slug: "jules-try", settings: false, persona: true, database: true });
    expect(out.ok).toBe(true);
    expect(out.detail).toMatch(/persona, database/);
    const destDir = join(dirs[0]!, "gantries", "jules-try");
    expect(loadEnvFile(join(destDir, ".env")).TELEGRAM_BOT_TOKEN).toBeUndefined();
    const copied = new DatabaseSync(join(destDir, "data", "gantry.db"), { readOnly: true });
    expect(copied.prepare("SELECT v FROM mem WHERE k = 'who'").get()).toEqual({ v: "jules" });
    copied.close();
  });

  it("refuses a dest that already exists", async () => {
    seedJules();
    writeCraneFiles({ slug: "taken" });
    expect(await cloneCrane("jules", { slug: "taken", settings: true, persona: false, database: false })).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/already exists/),
    });
  });

  it("keeps dest files when docker create fails", async () => {
    seedJules();
    vi.mocked(createOrReplaceContainer).mockRejectedValue(new Error("hub down"));
    const out = await cloneCrane("jules", { slug: "kit-copy", settings: true, persona: false, database: false });
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/wrote gantries\/kit-copy/);
    expect(out.detail).toMatch(/hub down/);
    expect(existsSync(join(dirs[0]!, "gantries", "kit-copy", ".env"))).toBe(true);
  });
});

describe("GET /api/gantries/[slug]", () => {
  it("tells the dashboard whether this session can clone", async () => {
    seedJules();
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const user = addOperator("ada", pass, "user", "jules");
    expect(user.ok).toBe(true);
    if (!user.ok) {
      return;
    }
    const ada = loginOperator("ada", pass);
    expect(ada.ok).toBe(true);
    if (!ada.ok) {
      return;
    }
    async function loadAs(token: string) {
      return getGantry(
        new Request("http://127.0.0.1/api/gantries/jules", {
          headers: { cookie: `${SESSION_COOKIE}=${token}` },
        }),
        { params: Promise.resolve({ slug: "jules" }) },
      );
    }
    const adminBody = (await (await loadAs(first.token)).json()) as { canMutate: boolean; canBuild: boolean };
    expect(adminBody).toMatchObject({ canMutate: true, canBuild: true });
    const userBody = (await (await loadAs(ada.token)).json()) as { canMutate: boolean; canBuild: boolean };
    expect(userBody).toMatchObject({ canMutate: true, canBuild: false });
  });
});

describe("POST /api/gantries/[slug]/clone", () => {
  async function cloneAs(token: string, source: string, body: Record<string, unknown>) {
    return cloneGantry(
      new Request(`http://127.0.0.1/api/gantries/${source}/clone`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug: source }) },
    );
  }

  it("is admin-only and records a clone event on the dest", async () => {
    seedJules();
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const user = addOperator("ada", pass, "user", "jules");
    expect(user.ok).toBe(true);
    if (!user.ok) {
      return;
    }
    const ada = loginOperator("ada", pass);
    expect(ada.ok).toBe(true);
    if (!ada.ok) {
      return;
    }
    const forbidden = await cloneAs(ada.token, "jules", { slug: "try", settings: true });
    expect(forbidden.status).toBe(403);

    const res = await cloneAs(first.token, "jules", { slug: "try", settings: true, persona: true });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; slug: string };
    expect(data).toMatchObject({ ok: true, slug: "try" });
    const events = listYardEvents({ kind: "clone" });
    expect(events[0]?.slug).toBe("try");
    expect(events[0]?.detail).toMatch(/jules/);
  });
});
