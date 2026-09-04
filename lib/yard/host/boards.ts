import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BoardChallenge, BoardNotice, BoardRosterEntry, BoardScore, BoardSnapshot } from "../types";
import { boardsDir } from "./files";

const FILE_ROSTER = "roster.jsonl";
const FILE_CHALLENGES = "challenges.jsonl";
const FILE_CHECKINS = "checkins.jsonl";
const FILE_NOTICES = "notices.jsonl";
const MAX_OPEN = 8;
const MAX_PINS = 8;

export const EMPTY_BOARD: BoardSnapshot = { roster: [], open: [], pins: [], empty: true };

export { BOARD_KIND_CATALOG, boardKindLabel, displayBoardName, formatBoardScore } from "./boardFormat";

type Raw = Record<string, unknown>;

export function loadBoardSnapshot(dir = boardsDir()): BoardSnapshot {
  try {
    if (!existsSync(dir)) {
      return EMPTY_BOARD;
    }
    const roster = lastByAuthor(readJsonl(resolve(dir, FILE_ROSTER)).map(asRoster).filter((r): r is BoardRosterEntry => r != null));
    const checkins = readJsonl(resolve(dir, FILE_CHECKINS)).map(asCheckIn).filter((r): r is CheckIn => r != null);
    const open = newestOpen(readJsonl(resolve(dir, FILE_CHALLENGES)).map(asChallenge).filter((r): r is RawChallenge => r != null), checkins);
    const pins = newestPins(readJsonl(resolve(dir, FILE_NOTICES)).map(asNotice).filter((r): r is BoardNotice => r != null));
    return { roster, open, pins, empty: roster.length === 0 && open.length === 0 && pins.length === 0 };
  } catch {
    return EMPTY_BOARD;
  }
}

type RawChallenge = {
  id: string;
  title: string;
  kind: string;
  mode: string;
  target: number;
  windowStart: string;
  windowEnd: string;
  status: string;
  participants: string[];
  winner: string;
};

type CheckIn = {
  challengeId: string;
  author: string;
  value: number;
};

function readJsonl(path: string): Raw[] {
  if (!existsSync(path)) {
    return [];
  }
  const out: Raw[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const row: unknown = JSON.parse(t);
      if (row && typeof row === "object" && !Array.isArray(row)) {
        out.push(row as Raw);
      }
    } catch {
      /* torn last line or junk */
    }
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const s = str(x);
    if (!s || seen.has(s)) {
      continue;
    }
    seen.add(s);
    out.push(s);
  }
  return out;
}

function asRoster(row: Raw): BoardRosterEntry | null {
  const author = str(row.author);
  if (!author) {
    return null;
  }
  return { author, agentName: str(row.agent_name), userName: str(row.user_name) };
}

function asChallenge(row: Raw): RawChallenge | null {
  const id = str(row.id);
  const title = str(row.title);
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    kind: str(row.kind) || "custom",
    mode: str(row.mode) || "sum",
    target: num(row.target),
    windowStart: str(row.window_start),
    windowEnd: str(row.window_end),
    status: str(row.status) || "open",
    participants: strList(row.participants),
    winner: str(row.winner),
  };
}

function asCheckIn(row: Raw): CheckIn | null {
  const challengeId = str(row.challenge_id);
  const author = str(row.author);
  if (!challengeId || !author) {
    return null;
  }
  return { challengeId, author, value: num(row.value) };
}

function asNotice(row: Raw): BoardNotice | null {
  const id = str(row.id);
  const body = str(row.body);
  if (!id || !body) {
    return null;
  }
  return { id, author: str(row.author), body };
}

function lastByAuthor(rows: BoardRosterEntry[]): BoardRosterEntry[] {
  const by = new Map<string, BoardRosterEntry>();
  for (const r of rows) {
    by.set(r.author, r);
  }
  return [...by.values()];
}

function newestOpen(rows: RawChallenge[], checkins: CheckIn[]): BoardChallenge[] {
  const seen = new Set<string>();
  const out: BoardChallenge[] = [];
  for (let i = rows.length - 1; i >= 0 && out.length < MAX_OPEN; i--) {
    const c = rows[i];
    if (!c || c.status !== "open" || seen.has(c.id)) {
      continue;
    }
    seen.add(c.id);
    const scores = scoresFor(c, checkins.filter((r) => r.challengeId === c.id));
    out.push({
      id: c.id,
      title: c.title,
      kind: c.kind,
      mode: c.mode,
      target: c.target,
      windowStart: c.windowStart,
      windowEnd: c.windowEnd,
      status: c.status,
      participants: c.participants,
      scores,
      ...(c.winner ? { winner: c.winner } : {}),
    });
  }
  return out;
}

function newestPins(rows: BoardNotice[]): BoardNotice[] {
  const seen = new Set<string>();
  const out: BoardNotice[] = [];
  for (let i = rows.length - 1; i >= 0 && out.length < MAX_PINS; i--) {
    const n = rows[i];
    if (!n || seen.has(n.id)) {
      continue;
    }
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

/** Same aggregates as boards-mcp `scoresFor` (sum / average / daily). */
function scoresFor(c: RawChallenge, ins: CheckIn[]): BoardScore[] {
  const by = new Map<string, number[]>();
  for (const row of ins) {
    const cur = by.get(row.author) ?? [];
    cur.push(row.value);
    by.set(row.author, cur);
  }
  return c.participants.map((author) => {
    const rows = by.get(author) ?? [];
    let value = 0;
    if (c.mode === "sum") {
      value = rows.reduce((n, v) => n + v, 0);
    } else if (c.mode === "daily") {
      value = rows.filter((v) => v >= c.target).length;
    } else if (rows.length > 0) {
      value = rows.reduce((n, v) => n + v, 0) / rows.length;
    }
    return { author, value };
  });
}
