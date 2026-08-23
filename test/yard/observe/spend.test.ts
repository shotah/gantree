import { describe, expect, it } from "vitest";
import {
  alignBucket,
  bucketsForWindow,
  combineSpend,
  filterSamples,
  fmtEstTokens,
  parseSpendWindow,
  rollupTurns,
  tokenChartSeries,
  windowStart,
} from "@/lib/yard/observe/spend";
import type { TurnSample } from "@/lib/yard/types";

function turn(partial: Partial<TurnSample> & Pick<TurnSample, "at" | "key">): TurnSample {
  return {
    rounds: null,
    recoveries: null,
    estTokens: null,
    promptEstTokens: null,
    genEstTokens: null,
    source: null,
    userId: null,
    sessionId: null,
    outcome: null,
    ...partial,
  };
}

describe("rollupTurns", () => {
  it("ranks users and sources", () => {
    const rows = [
      turn({ at: 1, key: "a", estTokens: 100, promptEstTokens: 80, genEstTokens: 20, source: "user", userId: "1" }),
      turn({ at: 2, key: "b", estTokens: 50, promptEstTokens: 40, genEstTokens: 10, source: "user", userId: "2" }),
      turn({ at: 3, key: "c", estTokens: 200, promptEstTokens: 180, genEstTokens: 20, source: "cron", userId: "1" }),
      turn({ at: 4, key: "d", estTokens: 10, promptEstTokens: 10, genEstTokens: 0, source: "user" }),
      turn({ at: 5, key: "e", estTokens: 1, promptEstTokens: 1, genEstTokens: 0 }),
    ];
    const r = rollupTurns("ada", rows);
    expect(r.turns).toBe(5);
    expect(r.estTokens).toBe(361);
    expect(r.promptEst).toBe(311);
    expect(r.genEst).toBe(50);
    expect(r.unattributedTurns).toBe(2);
    expect(r.byUser.map((s) => [s.id, s.estTokens, s.turns])).toEqual([
      ["1", 300, 2],
      ["2", 50, 1],
    ]);
    expect(r.bySource[0]).toMatchObject({ id: "cron", estTokens: 200, turns: 1 });
    expect(r.bySource.find((s) => s.id === "unknown")?.turns).toBe(1);
  });
});

describe("combineSpend", () => {
  it("sorts cranes by spend and drops empties", () => {
    const yard = combineSpend([
      rollupTurns("quiet", []),
      rollupTurns("jules", [turn({ at: 1, key: "j", estTokens: 20, promptEstTokens: 20, genEstTokens: 0 })]),
      rollupTurns("ada", [turn({ at: 1, key: "a", estTokens: 80, promptEstTokens: 70, genEstTokens: 10 })]),
    ]);
    expect(yard.cranes.map((c) => c.slug)).toEqual(["ada", "jules"]);
    expect(yard.estTokens).toBe(100);
    expect(yard.turns).toBe(2);
  });
});

describe("fmtEstTokens", () => {
  it("compacts thousands", () => {
    expect(fmtEstTokens(0)).toBe("0");
    expect(fmtEstTokens(8400)).toBe("8.40k");
    expect(fmtEstTokens(16000)).toBe("16.0k");
  });
});

describe("spend window", () => {
  it("defaults unknown windows to 24h", () => {
    expect(parseSpendWindow(null)).toBe("24h");
    expect(parseSpendWindow("nope")).toBe("24h");
    expect(parseSpendWindow("6h")).toBe("6h");
    expect(windowStart("all")).toBeNull();
    expect(windowStart("1h", 10_000)).toBe(10_000 - 3600_000);
  });

  it("filters turns to the window", () => {
    const now = 1_000_000;
    const rows = [
      turn({ at: now - 10, key: "in", estTokens: 1 }),
      turn({ at: now - 5000, key: "out", estTokens: 9 }),
    ];
    expect(filterSamples(rows, now - 100, now).map((t) => t.key)).toEqual(["in"]);
  });

  it("limits buckets to the window width", () => {
    expect(bucketsForWindow("1h")).toEqual(["cumulative", "hour"]);
    expect(bucketsForWindow("24h")).toContain("day");
  });
});

describe("tokenChartSeries", () => {
  it("accumulates per-turn tokens instead of sitting at the last call", () => {
    const now = new Date(2026, 7, 22, 17, 0).getTime();
    const since = now - 3600_000;
    const series = tokenChartSeries(
      [
        turn({
          at: now - 40 * 60_000,
          key: "a",
          estTokens: 12_000,
          promptEstTokens: 11_000,
          genEstTokens: 1_000,
        }),
        turn({
          at: now - 10 * 60_000,
          key: "b",
          estTokens: 12_000,
          promptEstTokens: 11_000,
          genEstTokens: 1_000,
        }),
      ],
      { bucket: "cumulative", since, now },
    );
    expect(series[0]).toMatchObject({ at: since, tokens: 0, turns: 0 });
    expect(series[1]).toMatchObject({ tokens: 12_000, prompt: 11_000, gen: 1_000, turns: 1 });
    expect(series[2]).toMatchObject({ tokens: 24_000, turns: 2 });
    expect(series[3]).toMatchObject({ at: now, tokens: 24_000, turns: 2 });
  });

  it("fills idle hourly buckets with zeros", () => {
    const now = new Date(2026, 7, 22, 17, 0).getTime();
    const since = new Date(2026, 7, 22, 14, 0).getTime();
    const series = tokenChartSeries(
      [
        turn({
          at: new Date(2026, 7, 22, 14, 30).getTime(),
          key: "a",
          estTokens: 12_000,
          promptEstTokens: 12_000,
          genEstTokens: 0,
        }),
        turn({
          at: new Date(2026, 7, 22, 16, 15).getTime(),
          key: "b",
          estTokens: 12_000,
          promptEstTokens: 12_000,
          genEstTokens: 0,
        }),
      ],
      { bucket: "hour", since, now },
    );
    expect(series.map((p) => [p.at, p.tokens, p.turns])).toEqual([
      [new Date(2026, 7, 22, 14, 0).getTime(), 12_000, 1],
      [new Date(2026, 7, 22, 15, 0).getTime(), 0, 0],
      [new Date(2026, 7, 22, 16, 0).getTime(), 12_000, 1],
      [new Date(2026, 7, 22, 17, 0).getTime(), 0, 0],
    ]);
  });

  it("aligns 6h and day buckets to local clock", () => {
    const at = new Date(2026, 7, 22, 14, 30).getTime();
    expect(alignBucket(at, "hour")).toBe(new Date(2026, 7, 22, 14, 0).getTime());
    expect(alignBucket(at, "6h")).toBe(new Date(2026, 7, 22, 12, 0).getTime());
    expect(alignBucket(at, "12h")).toBe(new Date(2026, 7, 22, 12, 0).getTime());
    expect(alignBucket(at, "day")).toBe(new Date(2026, 7, 22, 0, 0).getTime());
  });

  it("holds a zero line when slog exists but the window is idle", () => {
    const now = 10_000;
    const series = tokenChartSeries([turn({ at: 100, key: "old", estTokens: 12_000 })], {
      bucket: "cumulative",
      since: 8_000,
      now,
    });
    expect(series).toEqual([
      { at: 8_000, prompt: 0, gen: 0, tokens: 0, turns: 0 },
      { at: 10_000, prompt: 0, gen: 0, tokens: 0, turns: 0 },
    ]);
  });
});
