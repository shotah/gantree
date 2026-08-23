import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { yardRoot } from "../host/files";

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
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_salt  BLOB NOT NULL,
      pass_hash  BLOB NOT NULL,
      created_at TEXT NOT NULL
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
  `);
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
