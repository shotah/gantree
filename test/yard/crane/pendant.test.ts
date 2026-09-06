import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";
import { writeEnvFile } from "@/lib/yard/host/envfile";

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

vi.mock("@/lib/yard/door/operators", () => ({
  listOperators: vi.fn(() => []),
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { inspectByName } from "@/lib/yard/host/docker";
import { peekTurns } from "@/lib/yard/observe/stats";
import { listOperators } from "@/lib/yard/door/operators";
import {
  cranePendantAuth,
  parsePendantAllowlist,
  pendantEntryForOperator,
  pendantSnapshot,
  saveGantryPendantAllowlist,
} from "@/lib/yard/crane/pendant";

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
  vi.mocked(listOperators).mockReset();
  vi.mocked(listOperators).mockReturnValue([]);
});

function envFile(env: Record<string, string>): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  const path = join(root, ".env");
  writeEnvFile(path, env);
  return path;
}

describe("parsePendantAllowlist", () => {
  it("accepts sub, sub:email, and email, and drops junk", () => {
    expect(parsePendantAllowlist("118212345678901234567")).toEqual([
      { sub: "118212345678901234567", email: null },
    ]);
    expect(parsePendantAllowlist("118212345678901234567:Ada@Example.com")).toEqual([
      { sub: "118212345678901234567", email: "ada@example.com" },
    ]);
    expect(parsePendantAllowlist("ada@example.com")).toEqual([{ sub: null, email: "ada@example.com" }]);
    expect(parsePendantAllowlist("nope @ada 123")).toEqual([]);
    expect(parsePendantAllowlist("118212345678901234567,118212345678901234567:ada@example.com")).toEqual([
      { sub: "118212345678901234567", email: null },
    ]);
  });
});

describe("pendantEntryForOperator", () => {
  it("writes sub:email when google is set, else email, and refuses neither", () => {
    expect(
      pendantEntryForOperator({
        email: "Ada@Example.com",
        channels: { google: ["118212345678901234567"] },
      }),
    ).toEqual({ ok: true, entry: "118212345678901234567:ada@example.com" });
    expect(pendantEntryForOperator({ email: "ada@example.com", channels: { google: [] } })).toEqual({
      ok: true,
      entry: "ada@example.com",
    });
    expect(pendantEntryForOperator({ email: "", channels: { google: [] } })).toEqual({
      ok: false,
      error: "operator has neither Google sub nor email",
    });
  });
});

describe("saveGantryPendantAllowlist", () => {
  it("writes PENDANT_ALLOWED_USERS as sub:email vs email and asks for recreate", async () => {
    const path = envFile({ CHANNEL: "pendant", PENDANT_BEARER: "b", PENDANT_ALLOWED_USERS: "" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "pendant", envFile: path }));
    const r = await saveGantryPendantAllowlist("kit", [
      "118212345678901234567:Ada@Example.com",
      "ada@example.com",
      "nope",
    ]);
    expect(r.ok).toBe(true);
    expect(r.allowlist).toEqual(["118212345678901234567:ada@example.com"]);
    expect(r.detail).toMatch(/recreate/);
    expect(readFileSync(path, "utf8")).toContain("PENDANT_ALLOWED_USERS=118212345678901234567:ada@example.com");

    const emailOnly = await saveGantryPendantAllowlist("kit", ["bob@example.com"]);
    expect(emailOnly.allowlist).toEqual(["bob@example.com"]);
    expect(readFileSync(path, "utf8")).toContain("PENDANT_ALLOWED_USERS=bob@example.com");
  });

  it("refuses a non-pendant crane", async () => {
    const path = envFile({ CHANNEL: "telegram" });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: path }));
    const r = await saveGantryPendantAllowlist("kit", ["ada@example.com"]);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("not pendant");
  });

  it("fails closed without a gantry or env file", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await saveGantryPendantAllowlist("kit", ["ada@example.com"])).toMatchObject({
      ok: false,
      detail: "not found",
    });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "pendant", envFile: null }));
    expect(await saveGantryPendantAllowlist("kit", ["ada@example.com"])).toMatchObject({
      ok: false,
      detail: "no env_file",
    });
  });
});

describe("cranePendantAuth", () => {
  it("reports mailbox, bearer, and parsed allowlist", async () => {
    const path = envFile({
      CHANNEL: "pendant",
      PENDANT_MAILBOX_URL: "wss://example/ws/kit",
      PENDANT_BEARER: "secret",
      PENDANT_ALLOWED_USERS: "ada@example.com",
    });
    const auth = await cranePendantAuth(card({ channel: "pendant", envFile: path }));
    expect(auth).toMatchObject({
      channel: "pendant",
      mailboxUrl: "wss://example/ws/kit",
      bearerSet: true,
      allowlist: [{ sub: null, email: "ada@example.com" }],
    });
  });

  it("ignores docker inspect failures", async () => {
    vi.mocked(inspectByName).mockRejectedValue(new Error("no docker"));
    const auth = await cranePendantAuth(card({ channel: null, envFile: envFile({}) }));
    expect(auth.channel).toBeNull();
    expect(auth.bearerSet).toBe(false);
  });
});

describe("pendantSnapshot", () => {
  it("returns null when the crane is missing", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await pendantSnapshot("nope")).toBeNull();
  });

  it("is disabled when the channel is not pendant", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "telegram", envFile: envFile({ CHANNEL: "telegram" }) }));
    const snap = await pendantSnapshot("kit");
    expect(snap?.enabled).toBe(false);
    expect(snap?.detail).toBe("not pendant");
  });

  it("includes slog ids that are on no entry", async () => {
    const path = envFile({
      CHANNEL: "pendant",
      PENDANT_BEARER: "b",
      PENDANT_ALLOWED_USERS: "ada@example.com",
    });
    vi.mocked(getGantry).mockResolvedValue(card({ channel: "pendant", envFile: path }));
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
        userId: "118212345678901234567",
        sessionId: "s",
        outcome: "ok",
      },
    ]);
    const snap = await pendantSnapshot("kit");
    expect(snap).toMatchObject({
      enabled: true,
      bearerSet: true,
      allowlist: ["ada@example.com"],
    });
    expect(snap?.seen).toEqual([{ id: "118212345678901234567", turns: 1, lastAt: 10 }]);
  });
});
