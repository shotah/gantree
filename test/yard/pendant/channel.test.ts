import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeCraneFiles } from "@/lib/yard/crane/build";
import { closeYardDb } from "@/lib/yard/door/store";
import { loadEnvFile } from "@/lib/yard/host/envfile";
import {
  dropPendantBearer,
  pendantChannelReady,
  provisionPendantCrane,
  rotatePendantBearer,
} from "@/lib/yard/pendant/channel";
import { loadPendantSettings, persistPendantSettings } from "@/lib/yard/pendant/settings";
import type { CloudflarePoster } from "@/lib/yard/pendant/cloudflare";

vi.mock("@/lib/yard/crane/inventory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/crane/inventory")>();
  return { ...actual, getGantry: vi.fn() };
});

import { getGantry } from "@/lib/yard/crane/inventory";

const dirs: string[] = [];
const TOKEN = "cf-token-abcdefghijklmnopqrstuvwxyz";
const ACCOUNT = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  process.env.GANTREE_DB = join(root, "gantree.db");
  closeYardDb();
  vi.mocked(getGantry).mockReset();
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

function seedCf() {
  persistPendantSettings({
    ...loadPendantSettings(),
    apiToken: TOKEN,
    accountId: ACCOUNT,
    origin: "https://gantry-pendant.example.workers.dev",
  });
}

function recordingPost(): { post: CloudflarePoster; names: string[]; texts: Record<string, string> } {
  const names: string[] = [];
  const texts: Record<string, string> = {};
  const post: CloudflarePoster = async (_url, init) => {
    const body = JSON.parse(String(init.body)) as { name: string; text: string };
    names.push(body.name);
    texts[body.name] = body.text;
    return { status: 200, body: JSON.stringify({ success: true, result: { name: body.name, type: "secret_text" } }) };
  };
  return { post, names, texts };
}

describe("provisionPendantCrane", () => {
  it("refuses without Settings Cloudflare", async () => {
    expect(pendantChannelReady().ok).toBe(false);
    const out = await provisionPendantCrane("kit", "ada@example.com");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.detail).toMatch(/Settings → Pendant/);
    }
  });

  it("mints a bearer, merges CRANE_BEARERS, and fills mailbox env", async () => {
    seedCf();
    persistPendantSettings({
      ...loadPendantSettings(),
      craneBearers: { ada: "keep-me-please-token" },
    });
    const { post, names, texts } = recordingPost();
    const first = await provisionPendantCrane("kit", "ada@example.com", { post, mint: () => "minted-kit-bearer-token" });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(names).toEqual(["CRANE_BEARERS"]);
    expect(texts.CRANE_BEARERS).toBe("ada:keep-me-please-token,kit:minted-kit-bearer-token");
    expect(first.env).toEqual({
      CHANNEL: "pendant",
      PENDANT_MAILBOX_URL: "wss://gantry-pendant.example.workers.dev/ws/kit",
      PENDANT_BEARER: "minted-kit-bearer-token",
      PENDANT_ALLOWED_USERS: "ada@example.com",
    });
    const second = await provisionPendantCrane("tryout", "", { post, mint: () => "minted-tryout-bearer-token" });
    expect(second.ok).toBe(true);
    expect(texts.CRANE_BEARERS).toContain("kit:minted-kit-bearer-token");
    expect(texts.CRANE_BEARERS).toContain("tryout:minted-tryout-bearer-token");
    expect(texts.CRANE_BEARERS).toContain("ada:keep-me-please-token");
  });

  it("does not persist the map when Cloudflare refuses", async () => {
    seedCf();
    const post: CloudflarePoster = async () => ({
      status: 400,
      body: JSON.stringify({ success: false, errors: [{ message: "nope" }] }),
    });
    const out = await provisionPendantCrane("kit", "", { post, mint: () => "minted-kit-bearer-token" });
    expect(out.ok).toBe(false);
    expect(loadPendantSettings().craneBearers).toEqual({});
  });
});

describe("rotatePendantBearer", () => {
  it("rewrites .env and nags recreate", async () => {
    seedCf();
    const files = writeCraneFiles({
      slug: "kit",
      channel: "pendant",
      env: {
        CHANNEL: "pendant",
        PENDANT_BEARER: "old-bearer-value-here",
        PENDANT_ALLOWED_USERS: "ada@example.com",
      },
    });
    vi.mocked(getGantry).mockResolvedValue({
      slug: "kit",
      channel: "pendant",
      envFile: files.envFile,
    } as never);
    const { post } = recordingPost();
    const out = await rotatePendantBearer("kit", { post, mint: () => "new-bearer-value-here" });
    expect(out.ok).toBe(true);
    expect(out.detail).toMatch(/recreate/);
    expect(loadEnvFile(files.envFile).PENDANT_BEARER).toBe("new-bearer-value-here");
    expect(loadEnvFile(files.envFile).PENDANT_ALLOWED_USERS).toBe("ada@example.com");
  });
});

describe("dropPendantBearer", () => {
  it("drops the slug and puts the remaining map", async () => {
    seedCf();
    persistPendantSettings({
      ...loadPendantSettings(),
      craneBearers: { kit: "k", ada: "a" },
    });
    const { post, texts } = recordingPost();
    const out = await dropPendantBearer("kit", { post });
    expect(out).toMatchObject({ ok: true, pushed: true });
    expect(texts.CRANE_BEARERS).toBe("ada:a");
    expect(loadPendantSettings().craneBearers).toEqual({ ada: "a" });
  });
});
