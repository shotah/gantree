import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";
import { writeEnvFile } from "@/lib/yard/host/envfile";
import type { TelegramPoster } from "@/lib/yard/host/telegram";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/host/docker", () => ({
  inspectByName: vi.fn(),
}));

vi.mock("@/lib/yard/observe/stats", () => ({
  sampleTurns: vi.fn(async () => []),
  peekTurns: vi.fn(() => []),
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { inspectByName } from "@/lib/yard/host/docker";
import { peekTurns } from "@/lib/yard/observe/stats";
import { pushTelegramProfile, saveGantryAllowlist, telegramSnapshot } from "@/lib/yard/crane/telegram";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(inspectByName).mockReset();
  vi.mocked(peekTurns).mockReset();
  vi.mocked(peekTurns).mockReturnValue([]);
});

function envFile(env: Record<string, string>): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  const path = join(root, ".env");
  writeEnvFile(path, env);
  return path;
}

function poster(map: Record<string, unknown>): TelegramPoster {
  return async (url) => {
    const method = url.split("/").pop() ?? "";
    return { status: 200, body: JSON.stringify({ ok: true, result: map[method] ?? true }) };
  };
}

describe("telegramSnapshot", () => {
  it("returns null when the crane is missing", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await telegramSnapshot("nope")).toBeNull();
  });

  it("is disabled when the channel is not telegram", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "discord", envFile: envFile({ CHANNEL: "discord" }) }));
    const snap = await telegramSnapshot("kit");
    expect(snap?.enabled).toBe(false);
    expect(snap?.detail).toBe("not telegram");
  });

  it("stays enabled without calling Telegram when the token is missing", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: envFile({ CHANNEL: "telegram" }) }));
    let called = 0;
    const post: TelegramPoster = async () => {
      called += 1;
      return { status: 200, body: "{}" };
    };
    const snap = await telegramSnapshot("kit", post);
    expect(snap).toMatchObject({ enabled: true, tokenSet: false, detail: "no TELEGRAM_BOT_TOKEN" });
    expect(called).toBe(0);
  });

  it("ignores docker inspect failures when resolving the token", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ channel: null, envFile: envFile({}) }));
    vi.mocked(inspectByName).mockRejectedValue(new Error("no docker"));
    const snap = await telegramSnapshot("kit");
    expect(snap?.enabled).toBe(false);
  });

  it("returns getMe plus slog ids", async () => {
    const path = envFile({
      CHANNEL: "telegram",
      TELEGRAM_BOT_TOKEN: "123:abc",
      TELEGRAM_ALLOWED_USERS: "1,2",
    });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: path }));
    vi.mocked(peekTurns).mockReturnValue([
      {
        at: 10,
        key: "a",
        rounds: 1,
        recoveries: 0,
        estTokens: 1,
        promptEstTokens: 1,
        genEstTokens: 0,
        source: "user",
        userId: "9",
        sessionId: "s",
        outcome: "ok",
      },
    ]);
    const snap = await telegramSnapshot(
      "kit",
      poster({
        getMe: { id: 99, first_name: "Kit", username: "kit_bot" },
        getMyName: { name: "Kit" },
        getMyDescription: { description: "" },
        getMyShortDescription: { short_description: "" },
        getMyCommands: [],
      }),
    );
    expect(snap).toMatchObject({
      enabled: true,
      tokenSet: true,
      bot: { id: 99, username: "kit_bot", firstName: "Kit" },
      allowlist: ["1", "2"],
      link: "https://t.me/kit_bot",
    });
    expect(snap?.seen).toEqual([{ id: "9", turns: 1, lastAt: 10 }]);
  });
});

describe("saveGantryAllowlist", () => {
  it("writes TELEGRAM_ALLOWED_USERS and asks for recreate", async () => {
    const path = envFile({ CHANNEL: "telegram", TELEGRAM_BOT_TOKEN: "t", TELEGRAM_ALLOWED_USERS: "1" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: path }));
    const r = await saveGantryAllowlist("kit", ["9", "9", "@nope"]);
    expect(r.ok).toBe(true);
    expect(r.allowlist).toEqual(["9"]);
    expect(r.detail).toMatch(/recreate/);
    expect(readFileSync(path, "utf8")).toContain("TELEGRAM_ALLOWED_USERS=9");
  });

  it("refuses a non-telegram crane", async () => {
    const path = envFile({ CHANNEL: "stdio" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "stdio", envFile: path }));
    const r = await saveGantryAllowlist("kit", ["1"]);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("not telegram");
  });

  it("fails closed without a gantry or env file", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await saveGantryAllowlist("kit", ["1"])).toMatchObject({ ok: false, detail: "not found" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: null }));
    expect(await saveGantryAllowlist("kit", ["1"])).toMatchObject({ ok: false, detail: "no env_file" });
  });
});

describe("pushTelegramProfile", () => {
  it("refuses without a token", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: envFile({ CHANNEL: "telegram" }) }));
    const r = await pushTelegramProfile("kit", { name: "Kit" });
    expect(r).toEqual({ ok: false, detail: "no TELEGRAM_BOT_TOKEN" });
  });

  it("refuses a missing or non-telegram crane", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await pushTelegramProfile("kit", { name: "Kit" })).toEqual({ ok: false, detail: "not found" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "discord", envFile: envFile({ CHANNEL: "discord" }) }));
    expect(await pushTelegramProfile("kit", { name: "Kit" })).toEqual({ ok: false, detail: "not telegram" });
  });

  it("pushes name through the injected poster", async () => {
    const path = envFile({ CHANNEL: "telegram", TELEGRAM_BOT_TOKEN: "123:abc" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: path }));
    const methods: string[] = [];
    const post: TelegramPoster = async (url) => {
      methods.push(url.split("/").pop() ?? "");
      return { status: 200, body: JSON.stringify({ ok: true, result: true }) };
    };
    const r = await pushTelegramProfile("kit", { name: "Kit" }, post);
    expect(r.ok).toBe(true);
    expect(methods).toEqual(["setMyName"]);
  });
});
