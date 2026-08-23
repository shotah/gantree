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
import { persistHost, persistMcp, persistTurn, persistUptime, recallSamples, RETAIN_MS } from "@/lib/yard/observe/memory";
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
  process.env.GANTREE_DB = join(root, "gantree.db");
});

afterEach(() => {
  closeYardDb();
  clearObserveRings();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
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
    });
    persistTurn("kit", {
      at: Date.now() - RETAIN_MS - 5_000,
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
    persistHost("kit", { at: Date.now(), cpuPercent: 12, memBytes: 100, memLimitBytes: 200 });
    persistMcp("kit", { at: Date.now(), published: 1, skipped: 1 });
    persistUptime("kit", { at: Date.now(), uptimeSeconds: 12, restartCount: 0 });

    const recalled = recallSamples("kit", { host: 720, turns: 400, mcp: 200, uptime: 720 });
    expect(recalled.turns.map((t) => t.key)).toEqual(["turn-now"]);
    expect(recalled.host).toHaveLength(1);
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
});
