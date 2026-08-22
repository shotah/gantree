import { describe, expect, it } from "vitest";
import { combineSpend, fmtEstTokens, rollupTurns } from "./spend";
import type { TurnSample } from "./types";

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
    ];
    const r = rollupTurns("ada", rows);
    expect(r.turns).toBe(4);
    expect(r.estTokens).toBe(360);
    expect(r.promptEst).toBe(310);
    expect(r.genEst).toBe(50);
    expect(r.unattributedTurns).toBe(1);
    expect(r.byUser.map((s) => [s.id, s.estTokens, s.turns])).toEqual([
      ["1", 300, 2],
      ["2", 50, 1],
    ]);
    expect(r.bySource[0]).toMatchObject({ id: "cron", estTokens: 200, turns: 1 });
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
