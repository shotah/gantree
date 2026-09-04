import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BOARD_KIND_CATALOG,
  boardKindLabel,
  displayBoardName,
  formatBoardScore,
  loadBoardSnapshot,
} from "@/lib/yard/host/boards";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function boardDir(): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  mkdirSync(join(root, "boards"), { recursive: true });
  return join(root, "boards");
}

function jsonl(dir: string, name: string, rows: unknown[]): void {
  writeFileSync(join(dir, name), `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

describe("loadBoardSnapshot", () => {
  it("is empty when the corkboard dir is missing", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    expect(loadBoardSnapshot(join(root, "boards"))).toEqual({ roster: [], open: [], pins: [], empty: true });
  });

  it("is empty when the dir exists with no jsonl", () => {
    expect(loadBoardSnapshot(boardDir())).toEqual({ roster: [], open: [], pins: [], empty: true });
  });

  it("reads roster, skips junk lines, and last row wins per author", () => {
    const dir = boardDir();
    writeFileSync(
      join(dir, "roster.jsonl"),
      [
        JSON.stringify({ author: "kit", agent_name: "Kit", user_name: "Chris" }),
        "not-json",
        JSON.stringify({ author: "maya", agent_name: "Maya", user_name: "Sister" }),
        JSON.stringify({ author: "kit", agent_name: "Kit", user_name: "Christopher" }),
        "",
      ].join("\n"),
    );
    const snap = loadBoardSnapshot(dir);
    expect(snap.empty).toBe(false);
    expect(snap.roster).toEqual([
      { author: "kit", agentName: "Kit", userName: "Christopher" },
      { author: "maya", agentName: "Maya", userName: "Sister" },
    ]);
    expect(snap.open).toEqual([]);
    expect(snap.pins).toEqual([]);
  });

  it("scores open challenges newest first (sum / average / daily)", () => {
    const dir = boardDir();
    jsonl(dir, "roster.jsonl", [
      { author: "kit", agent_name: "Kit", user_name: "Chris" },
      { author: "maya", agent_name: "Maya", user_name: "Sister" },
    ]);
    jsonl(dir, "challenges.jsonl", [
      {
        id: "c_old",
        title: "old closed",
        kind: "steps",
        mode: "sum",
        target: 1,
        window_start: "2026-01-01",
        window_end: "2026-01-07",
        participants: ["kit"],
        status: "closed",
      },
      {
        id: "c_sleep",
        title: "sleep week",
        kind: "sleep",
        mode: "average",
        target: 80,
        window_start: "2026-09-01",
        window_end: "2026-09-07",
        participants: ["maya", "kit"],
        status: "open",
      },
      {
        id: "c_steps",
        title: "100k steps",
        kind: "steps",
        mode: "sum",
        target: 100000,
        window_start: "2026-09-01",
        window_end: "2026-09-14",
        participants: ["maya", "kit"],
        status: "open",
      },
      {
        id: "c_days",
        title: "move streak",
        kind: "move",
        mode: "daily",
        target: 30,
        window_start: "2026-09-01",
        window_end: "2026-09-07",
        participants: ["kit"],
        status: "open",
      },
    ]);
    jsonl(dir, "checkins.jsonl", [
      { challenge_id: "c_steps", author: "maya", value: 12000 },
      { challenge_id: "c_steps", author: "kit", value: 8000 },
      { challenge_id: "c_steps", author: "maya", value: 4000 },
      { challenge_id: "c_sleep", author: "maya", value: 82 },
      { challenge_id: "c_sleep", author: "maya", value: 78 },
      { challenge_id: "c_sleep", author: "kit", value: 90 },
      { challenge_id: "c_days", author: "kit", value: 40 },
      { challenge_id: "c_days", author: "kit", value: 10 },
      { challenge_id: "c_days", author: "kit", value: 30 },
    ]);
    const snap = loadBoardSnapshot(dir);
    expect(snap.open.map((c) => c.id)).toEqual(["c_days", "c_steps", "c_sleep"]);
    expect(snap.open.find((c) => c.id === "c_steps")?.scores).toEqual([
      { author: "maya", value: 16000 },
      { author: "kit", value: 8000 },
    ]);
    expect(snap.open.find((c) => c.id === "c_sleep")?.scores).toEqual([
      { author: "maya", value: 80 },
      { author: "kit", value: 90 },
    ]);
    expect(snap.open.find((c) => c.id === "c_days")?.scores).toEqual([{ author: "kit", value: 2 }]);
    expect(snap.pins).toEqual([]);
  });

  it("lists newest pins first and skips junk", () => {
    const dir = boardDir();
    writeFileSync(
      join(dir, "notices.jsonl"),
      [
        JSON.stringify({ id: "n_old", author: "kit", body: "first pin" }),
        "not-json",
        JSON.stringify({ id: "n_pr", author: "ada", body: "Sam beat her 5k PR!" }),
        JSON.stringify({ body: "no id" }),
        "",
      ].join("\n"),
    );
    const snap = loadBoardSnapshot(dir);
    expect(snap.empty).toBe(false);
    expect(snap.pins).toEqual([
      { id: "n_pr", author: "ada", body: "Sam beat her 5k PR!" },
      { id: "n_old", author: "kit", body: "first pin" },
    ]);
  });
});

describe("displayBoardName / formatBoardScore", () => {
  it("prefers the human name, then the agent, then the slug", () => {
    const roster = [
      { author: "kit", agentName: "Kit", userName: "Chris" },
      { author: "tryout", agentName: "Tryout", userName: "" },
    ];
    expect(displayBoardName(roster, "kit")).toBe("Chris");
    expect(displayBoardName(roster, "tryout")).toBe("Tryout");
    expect(displayBoardName(roster, "ghost")).toBe("ghost");
  });

  it("rounds steps whole, sleep and distance to one decimal", () => {
    expect(Object.keys(BOARD_KIND_CATALOG).sort()).toEqual([
      "count",
      "custom",
      "distance",
      "elevation",
      "move",
      "sleep",
      "steps",
    ]);
    expect(formatBoardScore("steps", 16100.4)).toBe("16,100");
    expect(formatBoardScore("count", 12.4)).toBe("12");
    expect(formatBoardScore("sleep", 81.26)).toBe("81.3");
    expect(formatBoardScore("distance", 12.04)).toBe("12");
    expect(formatBoardScore("elevation", 412.6)).toBe("413");
    expect(formatBoardScore("move", 47.2)).toBe("47");
    expect(boardKindLabel("sleep")).toBe("sleep");
    expect(boardKindLabel("count")).toBe("count");
    expect(boardKindLabel("distance")).toBe("km");
    expect(boardKindLabel("elevation")).toBe("m");
    expect(boardKindLabel("move")).toBe("move");
  });
});
