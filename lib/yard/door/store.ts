import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { yardRoot } from "../host/files";
import type { YardDbInspect } from "../types";

let db: DatabaseSync | null = null;
let openedPath: string | null = null;
let warnedOpenBind = false;

/** Yard-owned DB. Never a crane's data/gantry.db. */
export function dbPath(): string {
  if (process.env.GANTREE_DB) {
    return resolve(process.env.GANTREE_DB);
  }
  return resolve(yardRoot(), "gantree.db");
}

export function bindIsOpen(): boolean {
  const host = process.env.HOST || "127.0.0.1";
  return host === "0.0.0.0" || host === "::" || host === "[::]";
}

export function yardDb(): DatabaseSync {
  const path = dbPath();
  if (db && openedPath === path) {
    return db;
  }
  closeYardDb();
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  openedPath = path;
  migrate(db);
  return db;
}

export function closeYardDb(): void {
  db?.close();
  db = null;
  openedPath = null;
  warnedOpenBind = false;
}

function migrate(d: DatabaseSync): void {
  d.exec("PRAGMA journal_mode=WAL;");
  d.exec("PRAGMA foreign_keys=ON;");
  d.exec("PRAGMA busy_timeout=5000;");
  d.exec(`
    CREATE TABLE IF NOT EXISTS operator (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_salt    BLOB NOT NULL,
      pass_hash    BLOB NOT NULL,
      created_at   TEXT NOT NULL,
      display_name TEXT,
      email        TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      role         TEXT NOT NULL DEFAULT 'admin',
      crane_slug   TEXT,
      channels     TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS operator_session (
      token_hash   TEXT PRIMARY KEY,
      operator_id  TEXT NOT NULL REFERENCES operator(id) ON DELETE CASCADE,
      created_at   TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operator_session_operator
      ON operator_session(operator_id);
    CREATE TABLE IF NOT EXISTS yard_event (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      at          TEXT NOT NULL,
      kind        TEXT NOT NULL,
      slug        TEXT,
      operator_id TEXT,
      detail      TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_yard_event_at ON yard_event(at);
    CREATE TABLE IF NOT EXISTS sample_host (
      slug TEXT NOT NULL,
      at INTEGER NOT NULL,
      cpu_percent REAL,
      mem_bytes INTEGER,
      mem_limit_bytes INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sample_host_slug_at ON sample_host(slug, at);
    CREATE TABLE IF NOT EXISTS sample_turn (
      slug TEXT NOT NULL,
      at INTEGER NOT NULL,
      key TEXT NOT NULL,
      rounds INTEGER,
      recoveries INTEGER,
      est_tokens INTEGER,
      prompt_est_tokens INTEGER,
      gen_est_tokens INTEGER,
      source TEXT,
      user_id TEXT,
      session_id TEXT,
      outcome TEXT,
      UNIQUE(slug, key)
    );
    CREATE INDEX IF NOT EXISTS idx_sample_turn_slug_at ON sample_turn(slug, at);
    CREATE TABLE IF NOT EXISTS sample_mcp (
      slug TEXT NOT NULL,
      at INTEGER NOT NULL,
      published INTEGER NOT NULL,
      skipped INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sample_mcp_slug_at ON sample_mcp(slug, at);
    CREATE TABLE IF NOT EXISTS sample_uptime (
      slug TEXT NOT NULL,
      at INTEGER NOT NULL,
      uptime_seconds REAL,
      restart_count INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sample_uptime_slug_at ON sample_uptime(slug, at);
    CREATE TABLE IF NOT EXISTS sample_machine (
      at INTEGER NOT NULL,
      ncpu INTEGER,
      mem_total_bytes INTEGER,
      crane_cpu REAL,
      console_cpu REAL,
      other_cpu REAL,
      crane_mem INTEGER,
      console_mem INTEGER,
      other_mem INTEGER,
      crane_rx INTEGER,
      crane_tx INTEGER,
      console_rx INTEGER,
      console_tx INTEGER,
      other_rx INTEGER,
      other_tx INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sample_machine_at ON sample_machine(at);
  `);
  ensureColumn(d, "operator", "display_name", "TEXT");
  ensureColumn(d, "operator", "email", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(d, "operator", "description", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(d, "operator", "role", "TEXT NOT NULL DEFAULT 'admin'");
  ensureColumn(d, "operator", "crane_slug", "TEXT");
  ensureColumn(d, "operator", "channels", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(d, "sample_host", "net_rx_bytes", "INTEGER");
  ensureColumn(d, "sample_host", "net_tx_bytes", "INTEGER");
  ensureColumn(d, "sample_host", "blk_read_bytes", "INTEGER");
  ensureColumn(d, "sample_host", "blk_write_bytes", "INTEGER");
  ensureColumn(d, "sample_host", "disk_bytes", "INTEGER");
  ensureColumn(d, "sample_turn", "duration_ms", "REAL");
  ensureColumn(d, "sample_machine", "crane_rx", "INTEGER");
  ensureColumn(d, "sample_machine", "crane_tx", "INTEGER");
  ensureColumn(d, "sample_machine", "console_rx", "INTEGER");
  ensureColumn(d, "sample_machine", "console_tx", "INTEGER");
  ensureColumn(d, "sample_machine", "other_rx", "INTEGER");
  ensureColumn(d, "sample_machine", "other_tx", "INTEGER");
}

function ensureColumn(d: DatabaseSync, table: string, name: string, ddl: string): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === name)) {
    return;
  }
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
}

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Counts only — never row contents (operators hold pass hashes). */
export function inspectYardDb(): YardDbInspect {
  const path = dbPath();
  let sizeBytes: number | null = null;
  try {
    sizeBytes = statSync(path).size;
  } catch {
    /* missing db file — size stays null */
  }
  const db = yardDb();
  const journalRow = db.prepare("PRAGMA journal_mode").get() as Record<string, unknown> | undefined;
  const names = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as { name: string }[];
  const tables = names
    .filter((t) => TABLE_NAME.test(t.name))
    .map((t) => {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number } | undefined;
      return { name: t.name, rows: Number(row?.n ?? 0) };
    });
  return {
    path,
    sizeBytes,
    journal: journalRow ? String(Object.values(journalRow)[0] ?? "") || null : null,
    tables,
  };
}

export function warnOpenBindIfEmpty(empty: boolean): void {
  if (warnedOpenBind || !empty || !bindIsOpen()) {
    return;
  }
  warnedOpenBind = true;
  console.warn(
    "gantree: listening on all interfaces with no operators — only /setup is open. Create the first operator.",
  );
}
