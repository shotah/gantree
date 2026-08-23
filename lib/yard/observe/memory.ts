import { yardDb } from "../door/store";
import type { McpSample, StatSample, TurnSample, UptimeSample } from "../types";

/** Seven days on a Mini. Ring buffers stay the live window. */
export const RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
const HOST_CAP = 2000;
const TURN_CAP = 2000;
const MCP_CAP = 500;
const UPTIME_CAP = 2000;

export type RecalledSamples = {
  host: StatSample[];
  turns: TurnSample[];
  mcp: McpSample[];
  uptime: UptimeSample[];
};

export function persistHost(slug: string, sample: StatSample): void {
  try {
    const db = yardDb();
    db.prepare(
      "INSERT INTO sample_host (slug, at, cpu_percent, mem_bytes, mem_limit_bytes) VALUES (?, ?, ?, ?, ?)",
    ).run(slug, sample.at, sample.cpuPercent, sample.memBytes, sample.memLimitBytes);
    prune(db, "sample_host", slug, HOST_CAP);
  } catch {
    /* ring still works */
  }
}

export function persistTurn(slug: string, sample: TurnSample): void {
  try {
    yardDb()
      .prepare(
        `INSERT OR IGNORE INTO sample_turn (
           slug, at, key, rounds, recoveries, est_tokens, prompt_est_tokens, gen_est_tokens,
           source, user_id, session_id, outcome
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        sample.at,
        sample.key,
        sample.rounds,
        sample.recoveries,
        sample.estTokens,
        sample.promptEstTokens,
        sample.genEstTokens,
        sample.source,
        sample.userId,
        sample.sessionId,
        sample.outcome,
      );
    prune(yardDb(), "sample_turn", slug, TURN_CAP);
  } catch {
    /* ring still works */
  }
}

export function persistMcp(slug: string, sample: McpSample): void {
  try {
    yardDb()
      .prepare("INSERT INTO sample_mcp (slug, at, published, skipped) VALUES (?, ?, ?, ?)")
      .run(slug, sample.at, sample.published, sample.skipped);
    prune(yardDb(), "sample_mcp", slug, MCP_CAP);
  } catch {
    /* ring still works */
  }
}

export function persistUptime(slug: string, sample: UptimeSample): void {
  try {
    yardDb()
      .prepare("INSERT INTO sample_uptime (slug, at, uptime_seconds, restart_count) VALUES (?, ?, ?, ?)")
      .run(slug, sample.at, sample.uptimeSeconds, sample.restartCount);
    prune(yardDb(), "sample_uptime", slug, UPTIME_CAP);
  } catch {
    /* ring still works */
  }
}

export function recallSamples(slug: string, limits: { host: number; turns: number; mcp: number; uptime: number }): RecalledSamples {
  const cutoff = Date.now() - RETAIN_MS;
  try {
    const db = yardDb();
    const host = (
      db
        .prepare(
          "SELECT at, cpu_percent, mem_bytes, mem_limit_bytes FROM sample_host WHERE slug = ? AND at >= ? ORDER BY at ASC",
        )
        .all(slug, cutoff) as HostRow[]
    )
      .slice(-limits.host)
      .map((r) => ({
        at: Number(r.at),
        cpuPercent: num(r.cpu_percent),
        memBytes: num(r.mem_bytes),
        memLimitBytes: num(r.mem_limit_bytes),
      }));
    const turns = (
      db
        .prepare(
          `SELECT at, key, rounds, recoveries, est_tokens, prompt_est_tokens, gen_est_tokens,
                  source, user_id, session_id, outcome
           FROM sample_turn WHERE slug = ? AND at >= ? ORDER BY at ASC`,
        )
        .all(slug, cutoff) as TurnRow[]
    )
      .slice(-limits.turns)
      .map((r) => ({
        at: Number(r.at),
        key: r.key,
        rounds: num(r.rounds),
        recoveries: num(r.recoveries),
        estTokens: num(r.est_tokens),
        promptEstTokens: num(r.prompt_est_tokens),
        genEstTokens: num(r.gen_est_tokens),
        source: r.source,
        userId: r.user_id,
        sessionId: r.session_id,
        outcome: r.outcome,
      }));
    const mcp = (
      db
        .prepare("SELECT at, published, skipped FROM sample_mcp WHERE slug = ? AND at >= ? ORDER BY at ASC")
        .all(slug, cutoff) as McpRow[]
    )
      .slice(-limits.mcp)
      .map((r) => ({
        at: Number(r.at),
        published: Number(r.published),
        skipped: Number(r.skipped),
      }));
    const uptime = (
      db
        .prepare(
          "SELECT at, uptime_seconds, restart_count FROM sample_uptime WHERE slug = ? AND at >= ? ORDER BY at ASC",
        )
        .all(slug, cutoff) as UptimeRow[]
    )
      .slice(-limits.uptime)
      .map((r) => ({
        at: Number(r.at),
        uptimeSeconds: num(r.uptime_seconds),
        restartCount: num(r.restart_count),
      }));
    return { host, turns, mcp, uptime };
  } catch {
    return { host: [], turns: [], mcp: [], uptime: [] };
  }
}

type HostRow = { at: number; cpu_percent: number | null; mem_bytes: number | null; mem_limit_bytes: number | null };
type TurnRow = {
  at: number;
  key: string;
  rounds: number | null;
  recoveries: number | null;
  est_tokens: number | null;
  prompt_est_tokens: number | null;
  gen_est_tokens: number | null;
  source: string | null;
  user_id: string | null;
  session_id: string | null;
  outcome: string | null;
};
type McpRow = { at: number; published: number; skipped: number };
type UptimeRow = { at: number; uptime_seconds: number | null; restart_count: number | null };

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : v == null ? null : Number(v);
}

function prune(db: ReturnType<typeof yardDb>, table: string, slug: string, cap: number): void {
  const cutoff = Date.now() - RETAIN_MS;
  db.prepare(`DELETE FROM ${table} WHERE slug = ? AND at < ?`).run(slug, cutoff);
  const n = Number(
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE slug = ?`).get(slug) as { n: number } | undefined)?.n ?? 0,
  );
  if (n > cap) {
    db.prepare(
      `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE slug = ? ORDER BY at ASC LIMIT ?)`,
    ).run(slug, n - cap);
  }
}
