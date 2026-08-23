import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/observe/route";
import { addOperator, loginOperator, SESSION_COOKIE, setupOperator } from "@/lib/yard/door";
import { closeYardDb } from "@/lib/yard/door/store";
import { persistHost, persistTurn, pruneByObservePrefs, recallSamples } from "@/lib/yard/observe/memory";
import { DEFAULT_OBSERVE, loadObservePrefs, saveObservePrefs } from "@/lib/yard/observe/prefs";
import { DEFAULT_IMAGE } from "@/lib/yard/types";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "gantree-observe-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  process.env.GANTREE_DB = join(root, "gantree.db");
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

function cookieReq(path: string, token: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new Request(`http://127.0.0.1${path}`, { ...init, headers });
}

describe("observe prefs", () => {
  it("uses 7d host / 32d turn defaults when [observe] is missing", () => {
    expect(loadObservePrefs()).toEqual({
      ...DEFAULT_OBSERVE,
      defaultImage: DEFAULT_IMAGE,
      hostRetainDays: 7,
      turnRetainDays: 32,
      timezone: null,
      promptUsdPerMillion: null,
      genUsdPerMillion: null,
    });
  });

  it("round-trips retain, timezone, pin, and rates into gantree.toml", () => {
    const saved = saveObservePrefs({
      hostRetainDays: 3,
      turnRetainDays: 30,
      timezone: "America/Los_Angeles",
      defaultImage: "shotah/ai-gantry:latest",
      promptUsdPerMillion: 0.15,
      genUsdPerMillion: 0.6,
    });
    expect(saved.ok).toBe(true);
    expect(loadObservePrefs()).toMatchObject({
      hostRetainDays: 3,
      turnRetainDays: 30,
      timezone: "America/Los_Angeles",
      promptUsdPerMillion: 0.15,
      genUsdPerMillion: 0.6,
    });
    const toml = readFileSync(process.env.GANTREE_TOML!, "utf8");
    expect(toml).toContain("[observe]");
    expect(toml).toContain("host_retain_days = 3");
    expect(toml).toContain("turn_retain_days = 30");
    expect(toml).not.toMatch(/api[_-]?key/i);
  });

  it("rejects a non-IANA timezone", () => {
    const saved = saveObservePrefs({ timezone: "Los_Angeles" });
    expect(saved.ok).toBe(false);
    if (!saved.ok) {
      expect(saved.error).toMatch(/IANA/i);
    }
    expect(loadObservePrefs().timezone).toBeNull();
  });
});

describe("observe prune", () => {
  it("drops host samples older than the new retain cap", () => {
    const aged = Date.now() - 2 * 24 * 60 * 60 * 1000;
    persistHost("kit", { at: aged, cpuPercent: 12, memBytes: 100, memLimitBytes: 200 });
    persistTurn("kit", {
      at: aged,
      key: "turn-old",
      rounds: 1,
      recoveries: 0,
      estTokens: 10,
      promptEstTokens: 8,
      genEstTokens: 2,
      source: null,
      userId: null,
      sessionId: null,
      outcome: null,
    });
    expect(recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 }).host).toHaveLength(1);

    const saved = saveObservePrefs({ hostRetainDays: 1, turnRetainDays: 32 });
    expect(saved.ok).toBe(true);
    pruneByObservePrefs();

    const recalled = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(recalled.host).toEqual([]);
    expect(recalled.turns.map((t) => t.key)).toEqual(["turn-old"]);
  });
});

describe("PUT /api/observe", () => {
  it("lets an admin write and forbids a readonly operator", async () => {
    const admin = setupOperator("kit", "a-long-enough-pass");
    expect(admin.ok).toBe(true);
    if (!admin.ok) {
      return;
    }
    const added = addOperator("look", "a-long-enough-pass", "readonly", "kit");
    expect(added.ok).toBe(true);
    const look = loginOperator("look", "a-long-enough-pass");
    expect(look.ok).toBe(true);
    if (!look.ok) {
      return;
    }

    const forbidden = await PUT(
      cookieReq("/api/observe", look.token, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, turnRetainDays: 30 }),
      }),
    );
    expect(forbidden.status).toBe(403);

    const missingConfirm = await PUT(
      cookieReq("/api/observe", admin.token, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnRetainDays: 30 }),
      }),
    );
    expect(missingConfirm.status).toBe(400);

    const ok = await PUT(
      cookieReq("/api/observe", admin.token, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          timezone: "America/Los_Angeles",
          turnRetainDays: 30,
          promptUsdPerMillion: 0.15,
          genUsdPerMillion: 0.6,
        }),
      }),
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { observe: { turnRetainDays: number; timezone: string | null } };
    expect(body.observe.turnRetainDays).toBe(30);
    expect(body.observe.timezone).toBe("America/Los_Angeles");

    const peek = await GET(cookieReq("/api/observe", look.token));
    expect(peek.status).toBe(200);
    const seen = (await peek.json()) as { observe: { promptUsdPerMillion: number | null } };
    expect(seen.observe.promptUsdPerMillion).toBe(0.15);
  });
});
