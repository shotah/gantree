import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    containerStatsOnce: vi.fn(),
    containerLogsBuffer: vi.fn(),
  };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [{ name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." }],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { closeYardDb } from "@/lib/yard/door/store";
import {
  persistHost,
  persistMcp,
    persistTurn,
    persistUptime,
    recallSamples,
    dropCraneSamples,
    RETAIN_MS,
  TURN_RETAIN_MS,
} from "@/lib/yard/observe/memory";
import { clearObserveRings, peekTurns, sampleTurns } from "@/lib/yard/observe/stats";
import { containerLogsBuffer } from "@/lib/yard/host/docker";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(containerLogsBuffer).mockReset();
  closeYardDb();
  clearObserveRings();
  const root = mkdtempSync(join(tmpdir(), "gantree-mem-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  process.env.GANTREE_DB = join(root, "gantree.db");
});

afterEach(() => {
  closeYardDb();
  clearObserveRings();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_TOML;
  delete process.env.GANTREE_DB;
});

describe("yard memory", () => {
  it("recalls turns after a bounce and drops rows older than the retention cap", async () => {
    persistTurn("kit", {
      at: Date.now(),
      key: "turn-now",
      rounds: 1,
      recoveries: 0,
      estTokens: 12,
      promptEstTokens: 10,
      genEstTokens: 2,
      source: null,
      userId: null,
      sessionId: null,
      outcome: null,
      durationMs: 1500,
    });
    persistTurn("kit", {
      at: Date.now() - TURN_RETAIN_MS - 5_000,
      key: "turn-old",
      rounds: 1,
      recoveries: 0,
      estTokens: 99,
      promptEstTokens: 90,
      genEstTokens: 9,
      source: null,
      userId: null,
      sessionId: null,
      outcome: null,
    });
    persistHost("kit", {
      at: Date.now(),
      cpuPercent: 12,
      memBytes: 100,
      memLimitBytes: 200,
      netRxBytes: 50,
      netTxBytes: 9,
      blkReadBytes: 3,
      blkWriteBytes: 4,
      diskBytes: 9001,
    });
    persistMcp("kit", { at: Date.now(), published: 1, skipped: 1 });
    persistUptime("kit", { at: Date.now(), uptimeSeconds: 12, restartCount: 0 });

    const recalled = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(recalled.turns.map((t) => t.key)).toEqual(["turn-now"]);
    expect(recalled.host).toHaveLength(1);
    expect(recalled.host[0]?.netRxBytes).toBe(50);
    expect(recalled.host[0]?.blkWriteBytes).toBe(4);
    expect(recalled.host[0]?.diskBytes).toBe(9001);
    expect(recalled.turns[0]?.durationMs).toBe(1500);
    expect(recalled.mcp[0]?.skipped).toBe(1);
    expect(recalled.uptime[0]?.restartCount).toBe(0);

    const line =
      '{"time":"2026-08-22T18:00:00.000Z","msg":"turn perf","prompt_est_tokens":10,"gen_est_tokens":2,"iterations":1}\n';
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "kit" }));
    vi.mocked(containerLogsBuffer).mockResolvedValue(Buffer.from(line));
    await sampleTurns("kit");
    closeYardDb();
    clearObserveRings();
    expect(peekTurns("kit").some((t) => t.estTokens === 12)).toBe(true);
  });

  it("keeps turns older than the host week so this month still adds up", () => {
    const aged = Date.now() - RETAIN_MS - 5_000;
    persistTurn("kit", {
      at: aged,
      key: "turn-week-plus",
      rounds: 1,
      recoveries: 0,
      estTokens: 40,
      promptEstTokens: 30,
      genEstTokens: 10,
      source: null,
      userId: null,
      sessionId: null,
      outcome: null,
    });
    persistHost("kit", { at: aged, cpuPercent: 12, memBytes: 100, memLimitBytes: 200 });

    const recalled = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(recalled.turns.map((t) => t.key)).toEqual(["turn-week-plus"]);
    expect(recalled.host).toEqual([]);
  });

  it("keeps Kit's samples off Jules and ignores a duplicate turn key", () => {
    const now = Date.now();
    persistTurn("kit", {
      at: now,
      key: "turn-kit",
      rounds: 1,
      recoveries: 0,
      estTokens: 10,
      promptEstTokens: 8,
      genEstTokens: 2,
      source: "user",
      userId: "1",
      sessionId: null,
      outcome: "ok",
    });
    persistTurn("kit", {
      at: now + 1,
      key: "turn-kit",
      rounds: 9,
      recoveries: 9,
      estTokens: 999,
      promptEstTokens: 900,
      genEstTokens: 99,
      source: "user",
      userId: "1",
      sessionId: null,
      outcome: "ok",
    });
    persistTurn("jules", {
      at: now,
      key: "turn-jules",
      rounds: 1,
      recoveries: 0,
      estTokens: 50,
      promptEstTokens: 40,
      genEstTokens: 10,
      source: "cron",
      userId: null,
      sessionId: null,
      outcome: "ok",
    });
    persistHost("jules", { at: now, cpuPercent: 90, memBytes: 1, memLimitBytes: 2 });

    const kit = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    const jules = recallSamples("jules", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(kit.turns).toHaveLength(1);
    expect(kit.turns[0]).toMatchObject({ key: "turn-kit", estTokens: 10 });
    expect(jules.turns.map((t) => t.key)).toEqual(["turn-jules"]);
    expect(jules.host).toHaveLength(1);
    expect(kit.host).toEqual([]);
  });

  it("drops one crane's samples and leaves another", () => {
    const now = Date.now();
    persistTurn("kit", {
      at: now,
      key: "turn-kit",
      rounds: 1,
      recoveries: 0,
      estTokens: 10,
      promptEstTokens: 8,
      genEstTokens: 2,
      source: "user",
      userId: null,
      sessionId: null,
      outcome: "ok",
    });
    persistHost("kit", { at: now, cpuPercent: 1, memBytes: 1, memLimitBytes: 2 });
    persistMcp("kit", { at: now, published: 1, skipped: 0 });
    persistUptime("kit", { at: now, uptimeSeconds: 10, restartCount: 0 });
    persistTurn("jules", {
      at: now,
      key: "turn-jules",
      rounds: 1,
      recoveries: 0,
      estTokens: 4,
      promptEstTokens: 3,
      genEstTokens: 1,
      source: null,
      userId: null,
      sessionId: null,
      outcome: "ok",
    });
    dropCraneSamples("kit");
    const kit = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    const jules = recallSamples("jules", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(kit.turns).toEqual([]);
    expect(kit.host).toEqual([]);
    expect(kit.mcp).toEqual([]);
    expect(kit.uptime).toEqual([]);
    expect(jules.turns.map((t) => t.key)).toEqual(["turn-jules"]);
  });
});
