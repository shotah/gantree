import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeYardDb } from "@/lib/yard/door/store";
import {
  applyPendantSettingsPatch,
  loadPendantSettings,
  parsePendantSettingsPatch,
  persistCraneBearers,
  persistPendantSettings,
  pendantSettingsView,
  savePendantSettings,
} from "@/lib/yard/pendant/settings";
import type { CloudflarePoster } from "@/lib/yard/pendant/cloudflare";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_DB = join(root, "gantree.db");
  closeYardDb();
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_DB;
});

const TOKEN = "cf-token-abcdefghijklmnopqrstuvwxyz";
const ACCOUNT = "0123456789abcdef0123456789abcdef";

function okPost(): CloudflarePoster {
  return async () => ({ status: 200, body: JSON.stringify({ success: true, result: { name: "X", type: "secret_text" } }) });
}

describe("pendant settings store", () => {
  it("starts empty and masks secrets on the public view", () => {
    const view = pendantSettingsView();
    expect(view.ready).toBe(false);
    expect(view.apiTokenSet).toBe(false);
    expect(view.workerName).toBe("gantry-pendant");
    expect(view.googleRedirect).toBeNull();
  });

  it("persists Cloudflare fields off gantree.toml and never returns the token", () => {
    persistPendantSettings({
      ...loadPendantSettings(),
      apiToken: TOKEN,
      accountId: ACCOUNT,
      origin: "https://gantry-pendant.example.workers.dev",
      googleClientId: "id.apps.googleusercontent.com",
      googleClientSecret: "gsecret-long-enough",
      sessionSecret: "session-secret-value-here",
    });
    const row = loadPendantSettings();
    expect(row.apiToken).toBe(TOKEN);
    const view = pendantSettingsView(row);
    expect(view.ready).toBe(true);
    expect(view.oauthReady).toBe(true);
    expect(view.apiTokenSet).toBe(true);
    expect(view.googleRedirect).toBe(
      "https://gantry-pendant.example.workers.dev/api/auth/callback/google",
    );
    expect(JSON.stringify(view)).not.toContain(TOKEN);
    expect(JSON.stringify(view)).not.toContain("gsecret");
  });

  it("keeps an existing token when the patch leaves it blank", () => {
    persistPendantSettings({ ...loadPendantSettings(), apiToken: TOKEN, accountId: ACCOUNT });
    const applied = applyPendantSettingsPatch(loadPendantSettings(), { apiToken: "", origin: "https://p.example" });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.row.apiToken).toBe(TOKEN);
      expect(applied.row.origin).toBe("https://p.example");
    }
  });

  it("rejects a non-hex account id", () => {
    const applied = applyPendantSettingsPatch(loadPendantSettings(), { accountId: "not-hex" });
    expect(applied.ok).toBe(false);
  });
});

describe("parsePendantSettingsPatch", () => {
  it("rejects non-strings", () => {
    expect(parsePendantSettingsPatch({ apiToken: 1 })).toEqual({ error: "apiToken must be a string" });
    expect(parsePendantSettingsPatch(null)).toEqual({ error: "object required" });
  });
});

describe("savePendantSettings", () => {
  it("saves Cloudflare without pushing when Google is empty", async () => {
    let n = 0;
    const post: CloudflarePoster = async () => {
      n += 1;
      return { status: 200, body: "{}" };
    };
    const saved = await savePendantSettings(
      { apiToken: TOKEN, accountId: ACCOUNT, origin: "https://p.example.workers.dev" },
      post,
    );
    expect(saved.ok).toBe(true);
    expect(saved.detail).toMatch(/saved Cloudflare/);
    expect(n).toBe(0);
    expect(saved.pendant.ready).toBe(true);
  });

  it("pushes Google + SESSION_SECRET and mints session when empty", async () => {
    const names: string[] = [];
    const post: CloudflarePoster = async (_url, init) => {
      names.push((JSON.parse(String(init.body)) as { name: string }).name);
      return { status: 200, body: JSON.stringify({ success: true, result: { name: "n", type: "secret_text" } }) };
    };
    const saved = await savePendantSettings(
      {
        apiToken: TOKEN,
        accountId: ACCOUNT,
        origin: "https://p.example.workers.dev",
        googleClientId: "id.apps.googleusercontent.com",
        googleClientSecret: "gsecret-long-enough",
      },
      post,
    );
    expect(saved.ok).toBe(true);
    expect(names).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"]);
    expect(loadPendantSettings().sessionSecret.length).toBeGreaterThan(20);
    expect(saved.pendant.sessionSecretSet).toBe(true);
  });

  it("returns the Cloudflare error without writing a success", async () => {
    const post = okPost();
    await savePendantSettings(
      {
        apiToken: TOKEN,
        accountId: ACCOUNT,
        googleClientId: "id.apps.googleusercontent.com",
        googleClientSecret: "gsecret-long-enough",
      },
      post,
    );
    const fail: CloudflarePoster = async () => ({
      status: 400,
      body: JSON.stringify({ success: false, errors: [{ message: "nope" }] }),
    });
    const saved = await savePendantSettings(
      { googleClientId: "id.apps.googleusercontent.com", googleClientSecret: "gsecret-long-enough" },
      fail,
    );
    expect(saved.ok).toBe(false);
    expect(saved.detail).toMatch(/GOOGLE_CLIENT_ID: nope/);
  });
});

describe("persistCraneBearers", () => {
  it("stores the map as JSON in sqlite", () => {
    persistCraneBearers({ kit: "aaa", ada: "bbb" });
    expect(loadPendantSettings().craneBearers).toEqual({ kit: "aaa", ada: "bbb" });
  });
});
