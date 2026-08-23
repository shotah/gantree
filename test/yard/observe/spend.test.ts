import { describe, expect, it } from "vitest";
import {
  alignBucket,
  bucketsForWindow,
  combineSpend,
  estSpendUsd,
  filterSamples,
  fmtEstTokens,
  fmtSpendWindow,
  fmtUsd,
  monthStart,
  parseSpendWindow,
  rollupTurns,
  fmtBytes,
  fmtBps,
  fmtCores,
  FAT_DATA_DIR_BYTES,
  lastDiskBytes,
  hostNetRates,
  hostShare,
  namesFromOperators,
  labelSlices,
  spendPace,
  sourceChartSeries,
  thinChartPoints,
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
    expect(r.lastTurn).toMatchObject({ at: 5, estTokens: 1 });
    expect(r.trajectory.userTurns).toBe(3);
    expect(r.trajectory.userEst).toBe(160);
    expect(r.trajectory.byOutcome[0]).toMatchObject({ id: "ok" });
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
    expect(yard.bySource.map((s) => s.id)).toEqual(["unknown"]);
    expect(yard.lastTurn?.estTokens).toBe(80);
  });
});

describe("fmtEstTokens", () => {
  it("compacts thousands", () => {
    expect(fmtEstTokens(0)).toBe("0");
    expect(fmtEstTokens(8400)).toBe("8.40k");
    expect(fmtEstTokens(16000)).toBe("16.0k");
  });
});

describe("estSpendUsd", () => {
  it("returns null until a rate is pasted, then is a chars/4 calculator", () => {
    expect(estSpendUsd(1_000_000, 500_000, null)).toBeNull();
    expect(estSpendUsd(1_000_000, 500_000, { promptUsdPerMillion: null, genUsdPerMillion: null })).toBeNull();
    expect(estSpendUsd(1_000_000, 500_000, { promptUsdPerMillion: 0.15, genUsdPerMillion: 0.6 })).toBeCloseTo(0.45);
    expect(fmtUsd(0.45)).toBe("$0.45");
  });
});

describe("spend window", () => {
  it("defaults unknown windows to this month", () => {
    expect(parseSpendWindow(null)).toBe("month");
    expect(parseSpendWindow("nope")).toBe("month");
    expect(parseSpendWindow("6h")).toBe("6h");
    expect(windowStart("all")).toBeNull();
    expect(windowStart("1h", 10_000)).toBe(10_000 - 3600_000);
  });

  it("starts the month window at local midnight on the 1st", () => {
    const now = new Date(2026, 7, 22, 17, 0).getTime();
    expect(monthStart(now)).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime());
    expect(windowStart("month", now)).toBe(monthStart(now));
    expect(fmtSpendWindow("month")).toBe("this month");
  });

  it("drops last month's turns on the 1st", () => {
    const now = new Date(2026, 8, 2, 12, 0).getTime();
    const since = windowStart("month", now);
    const rows = [
      turn({ at: new Date(2026, 7, 31, 23, 59).getTime(), key: "aug", estTokens: 90 }),
      turn({ at: new Date(2026, 8, 1, 0, 1).getTime(), key: "sep", estTokens: 10 }),
    ];
    expect(filterSamples(rows, since, now).map((t) => t.key)).toEqual(["sep"]);
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
    expect(bucketsForWindow("month")).toContain("day");
  });

  it("projects month spend from elapsed days", () => {
    const now = new Date(2026, 7, 16, 0, 0, 0, 0).getTime();
    const pace = spendPace(150, "month", now);
    expect(pace).not.toBeNull();
    expect(pace?.perDay).toBeCloseTo(10, 5);
    expect(pace?.projected).toBeCloseTo(310, 5);
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

describe("sourceChartSeries", () => {
  it("counts turns per source instead of tokens", () => {
    const now = new Date(2026, 7, 22, 17, 0).getTime();
    const since = now - 3600_000;
    const series = sourceChartSeries(
      [
        turn({ at: now - 40 * 60_000, key: "a", source: "user" }),
        turn({ at: now - 10 * 60_000, key: "b", source: "cron" }),
        turn({ at: now - 5 * 60_000, key: "c", source: "user" }),
      ],
      { bucket: "cumulative", since, now },
    );
    expect(series[0]).toMatchObject({ at: since, user: 0, cron: 0 });
    expect(series[1]).toMatchObject({ user: 1, cron: 0 });
    expect(series[2]).toMatchObject({ user: 1, cron: 1 });
    expect(series[3]).toMatchObject({ user: 2, cron: 1 });
  });
});

describe("host formatters", () => {
  it("treats 100% Docker CPU as one core", () => {
    expect(fmtCores(80)).toBe("0.80");
    expect(fmtCores(110)).toBe("1.1");
    expect(fmtBytes(2 * 1024 ** 3)).toBe("2.0 GiB");
    expect(fmtBps(0)).toBe("0 B/s");
    expect(fmtBps(1500)).toBe("1 KiB/s");
    expect(hostShare(110, 400)).toBeCloseTo(0.275);
    expect(lastDiskBytes([{ diskBytes: 10 }, { diskBytes: 20 }])).toBe(20);
    expect(lastDiskBytes([{ diskBytes: null }])).toBeNull();
    expect(FAT_DATA_DIR_BYTES).toBe(256 * 1024 * 1024);
  });
});

describe("hostNetRates", () => {
  it("turns consecutive Docker counters into bytes/sec and clamps a recreate", () => {
    const a = {
      at: 1_000,
      ncpu: 4,
      memTotalBytes: 1,
      craneCpu: 0,
      consoleCpu: 0,
      otherCpu: 0,
      craneMem: 0,
      consoleMem: 0,
      otherMem: 0,
      craneRx: 10_000,
      craneTx: 1_000,
      consoleRx: 0,
      consoleTx: 0,
      otherRx: 0,
      otherTx: 0,
    };
    const b = { ...a, at: 11_000, craneRx: 30_000, craneTx: 3_000 };
    const reset = { ...a, at: 21_000, craneRx: 50, craneTx: 10 };
    const rates = hostNetRates([a, b, reset]);
    expect(rates[0]?.craneRx).toBe(0);
    expect(rates[1]?.craneRx).toBe(2_000);
    expect(rates[1]?.craneTx).toBe(200);
    expect(rates[2]?.craneRx).toBe(0);
  });
});

describe("namesFromOperators", () => {
  it("maps channel ids to display names and leaves unknown ids unlabeled", () => {
    const names = namesFromOperators([
      {
        name: "ada",
        displayName: "Ada",
        channels: { telegram: ["42"], slack: [], discord: [] },
      },
      {
        name: "bob",
        displayName: "",
        channels: { telegram: ["42", "99"], slack: ["U1"], discord: [] },
      },
    ]);
    expect(names).toEqual({ 42: "Ada", 99: "bob", U1: "bob" });
    expect(labelSlices([{ id: "42", turns: 1, estTokens: 10 }, { id: "7", turns: 1, estTokens: 3 }], names)).toEqual([
      { id: "42", turns: 1, estTokens: 10, label: "Ada" },
      { id: "7", turns: 1, estTokens: 3 },
    ]);
  });
});

describe("thinChartPoints", () => {
  it("keeps the ends and caps the middle", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => i);
    const thin = thinChartPoints(rows, 5);
    expect(thin[0]).toBe(0);
    expect(thin[thin.length - 1]).toBe(999);
    expect(thin).toHaveLength(5);
  });

  it("leaves short series alone", () => {
    expect(thinChartPoints([1, 2, 3], 240)).toEqual([1, 2, 3]);
  });
});
