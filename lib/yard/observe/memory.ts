import { yardDb } from "../door/store";
import type { HostSample, McpSample, StatSample, TurnSample, UptimeSample } from "../types";
import { hostRetainMs, turnRetainMs } from "./prefs";

/** Seven days on a Mini. Ring buffers stay the live window. */
export const RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
/** Turns follow the billing month (local 1st); host/mcp/uptime stay a week. */
export const TURN_RETAIN_MS = 32 * 24 * 60 * 60 * 1000;
const HOST_CAP = 2000;
const TURN_CAP = 10_000;
const MCP_CAP = 500;
const UPTIME_CAP = 2000;
const MACHINE_CAP = 2000;

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
      `INSERT INTO sample_host (
         slug, at, cpu_percent, mem_bytes, mem_limit_bytes,
         net_rx_bytes, net_tx_bytes, blk_read_bytes, blk_write_bytes, disk_bytes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      slug,
      sample.at,
      sample.cpuPercent,
      sample.memBytes,
      sample.memLimitBytes,
      sample.netRxBytes ?? null,
      sample.netTxBytes ?? null,
      sample.blkReadBytes ?? null,
      sample.blkWriteBytes ?? null,
      sample.diskBytes ?? null,
    );
    prune(db, "sample_host", slug, HOST_CAP, hostRetainMs());
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
           source, user_id, session_id, outcome, duration_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sample.durationMs ?? null,
      );
    prune(yardDb(), "sample_turn", slug, TURN_CAP, turnRetainMs());
  } catch {
    /* ring still works */
  }
}

export function persistMcp(slug: string, sample: McpSample): void {
  try {
    yardDb()
      .prepare("INSERT INTO sample_mcp (slug, at, published, skipped) VALUES (?, ?, ?, ?)")
      .run(slug, sample.at, sample.published, sample.skipped);
    prune(yardDb(), "sample_mcp", slug, MCP_CAP, hostRetainMs());
  } catch {
    /* ring still works */
  }
}

export function persistUptime(slug: string, sample: UptimeSample): void {
  try {
    yardDb()
      .prepare("INSERT INTO sample_uptime (slug, at, uptime_seconds, restart_count) VALUES (?, ?, ?, ?)")
      .run(slug, sample.at, sample.uptimeSeconds, sample.restartCount);
    prune(yardDb(), "sample_uptime", slug, UPTIME_CAP, hostRetainMs());
  } catch {
    /* ring still works */
  }
}

export function persistMachine(sample: HostSample): void {
  try {
    const db = yardDb();
    db.prepare(
      `INSERT INTO sample_machine (
         at, ncpu, mem_total_bytes, crane_cpu, console_cpu, other_cpu, crane_mem, console_mem, other_mem,
         crane_rx, crane_tx, console_rx, console_tx, other_rx, other_tx
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sample.at,
      sample.ncpu,
      sample.memTotalBytes,
      sample.craneCpu,
      sample.consoleCpu,
      sample.otherCpu,
      sample.craneMem,
      sample.consoleMem,
      sample.otherMem,
      sample.craneRx,
      sample.craneTx,
      sample.consoleRx,
      sample.consoleTx,
      sample.otherRx,
      sample.otherTx,
    );
    const cutoff = Date.now() - hostRetainMs();
    db.prepare("DELETE FROM sample_machine WHERE at < ?").run(cutoff);
    const n = Number((db.prepare("SELECT COUNT(*) AS n FROM sample_machine").get() as { n: number } | undefined)?.n ?? 0);
    if (n > MACHINE_CAP) {
      db.prepare("DELETE FROM sample_machine WHERE rowid IN (SELECT rowid FROM sample_machine ORDER BY at ASC LIMIT ?)").run(
        n - MACHINE_CAP,
      );
    }
  } catch {
    /* ring still works */
  }
}

export function recallMachine(limit: number): HostSample[] {
  const cutoff = Date.now() - hostRetainMs();
  try {
    const rows = yardDb()
      .prepare(
        `SELECT at, ncpu, mem_total_bytes, crane_cpu, console_cpu, other_cpu, crane_mem, console_mem, other_mem,
                crane_rx, crane_tx, console_rx, console_tx, other_rx, other_tx
         FROM sample_machine WHERE at >= ? ORDER BY at ASC`,
      )
      .all(cutoff) as MachineRow[];
    return rows.slice(-limit).map((r) => ({
      at: Number(r.at),
      ncpu: Number(r.ncpu) || 1,
      memTotalBytes: Number(r.mem_total_bytes) || 0,
      craneCpu: Number(r.crane_cpu) || 0,
      consoleCpu: Number(r.console_cpu) || 0,
      otherCpu: Number(r.other_cpu) || 0,
      craneMem: Number(r.crane_mem) || 0,
      consoleMem: Number(r.console_mem) || 0,
      otherMem: Number(r.other_mem) || 0,
      craneRx: Number(r.crane_rx) || 0,
      craneTx: Number(r.crane_tx) || 0,
      consoleRx: Number(r.console_rx) || 0,
      consoleTx: Number(r.console_tx) || 0,
      otherRx: Number(r.other_rx) || 0,
      otherTx: Number(r.other_tx) || 0,
    }));
  } catch {
    return [];
  }
}

export function recallSamples(slug: string, limits: { host: number; turns: number; mcp: number; uptime: number }): RecalledSamples {
  const cutoff = Date.now() - hostRetainMs();
  const turnCutoff = Date.now() - turnRetainMs();
  try {
    const db = yardDb();
    const host = (
      db
        .prepare(
          `SELECT at, cpu_percent, mem_bytes, mem_limit_bytes,
                  net_rx_bytes, net_tx_bytes, blk_read_bytes, blk_write_bytes, disk_bytes
           FROM sample_host WHERE slug = ? AND at >= ? ORDER BY at ASC`,
        )
        .all(slug, cutoff) as HostRow[]
    )
      .slice(-limits.host)
      .map((r) => ({
        at: Number(r.at),
        cpuPercent: num(r.cpu_percent),
        memBytes: num(r.mem_bytes),
        memLimitBytes: num(r.mem_limit_bytes),
        netRxBytes: num(r.net_rx_bytes),
        netTxBytes: num(r.net_tx_bytes),
        blkReadBytes: num(r.blk_read_bytes),
        blkWriteBytes: num(r.blk_write_bytes),
        diskBytes: num(r.disk_bytes),
      }));
    const turns = (
      db
        .prepare(
          `SELECT at, key, rounds, recoveries, est_tokens, prompt_est_tokens, gen_est_tokens,
                  source, user_id, session_id, outcome, duration_ms
           FROM sample_turn WHERE slug = ? AND at >= ? ORDER BY at ASC`,
        )
        .all(slug, turnCutoff) as TurnRow[]
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
        durationMs: num(r.duration_ms),
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

type HostRow = {
  at: number;
  cpu_percent: number | null;
  mem_bytes: number | null;
  mem_limit_bytes: number | null;
  net_rx_bytes: number | null;
  net_tx_bytes: number | null;
  blk_read_bytes: number | null;
  blk_write_bytes: number | null;
  disk_bytes: number | null;
};
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
  duration_ms: number | null;
};
type McpRow = { at: number; published: number; skipped: number };
type UptimeRow = { at: number; uptime_seconds: number | null; restart_count: number | null };
type MachineRow = {
  at: number;
  ncpu: number;
  mem_total_bytes: number;
  crane_cpu: number;
  console_cpu: number;
  other_cpu: number;
  crane_mem: number;
  console_mem: number;
  other_mem: number;
  crane_rx: number | null;
  crane_tx: number | null;
  console_rx: number | null;
  console_tx: number | null;
  other_rx: number | null;
  other_tx: number | null;
};

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : v == null ? null : Number(v);
}


export function pruneByObservePrefs(): void {
  try {
    const db = yardDb();
    const hostCut = Date.now() - hostRetainMs();
    const turnCut = Date.now() - turnRetainMs();
    for (const table of ["sample_host", "sample_mcp", "sample_uptime"] as const) {
      db.prepare(`DELETE FROM ${table} WHERE at < ?`).run(hostCut);
    }
    db.prepare("DELETE FROM sample_turn WHERE at < ?").run(turnCut);
    db.prepare("DELETE FROM sample_machine WHERE at < ?").run(hostCut);
  } catch {
    /* ring still works */
  }
}

export function dropCraneSamples(slug: string): void {
  try {
    const db = yardDb();
    for (const table of ["sample_host", "sample_turn", "sample_mcp", "sample_uptime"] as const) {
      db.prepare(`DELETE FROM ${table} WHERE slug = ?`).run(slug);
    }
  } catch {
    /* gone is gone */
  }
}

function prune(db: ReturnType<typeof yardDb>, table: string, slug: string, cap: number, retainMs = hostRetainMs()): void {
  const cutoff = Date.now() - retainMs;
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
