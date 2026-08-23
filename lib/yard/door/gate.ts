import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { bindIsOpen, warnOpenBindIfEmpty, yardDb } from "./store";

export const SESSION_COOKIE = "gantree_session";
/** Idle window — bump last_seen on each gated request. */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** Absolute lifetime from login. Cookie Max-Age matches this. */
export const SESSION_ABS_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_PASSPHRASE = 10;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const HASH_LEN = 32;
const DUMMY_SALT = Buffer.alloc(16, 7);

export type Operator = { id: string; name: string };

export type DoorStatus = {
  ready: boolean;
  operator: Operator | null;
  bindOpen: boolean;
};

const NAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

export function operatorCount(): number {
  const row = yardDb().prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function doorStatus(req: Request): DoorStatus {
  const ready = operatorCount() > 0;
  warnOpenBindIfEmpty(!ready);
  return { ready, operator: operatorFromRequest(req), bindOpen: bindIsOpen() };
}

export function denyUnlessOperator(req: Request): Response | null {
  const ready = operatorCount() > 0;
  warnOpenBindIfEmpty(!ready);
  if (!ready) {
    return Response.json({ error: "setup required", setup: true }, { status: 401 });
  }
  if (!operatorFromRequest(req, { touch: true })) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function withDoor<T extends unknown[]>(
  handler: (req: Request, ...args: T) => Promise<Response>,
): (req: Request, ...args: T) => Promise<Response> {
  return async (req, ...args) => {
    const blocked = denyUnlessOperator(req);
    if (blocked) {
      return blocked;
    }
    return handler(req, ...args);
  };
}

export function operatorFromRequest(req: Request, opts?: { touch?: boolean }): Operator | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  return sessionOperator(token, opts?.touch === true);
}

export function setupOperator(name: string, passphrase: string): { ok: true; operator: Operator; token: string } | { ok: false; error: string; status: number } {
  const fields = validateCredentials(name, passphrase);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  const db = yardDb();
  db.exec("BEGIN");
  try {
    const n = Number((db.prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined)?.n ?? 0);
    if (n > 0) {
      db.exec("ROLLBACK");
      return { ok: false, error: "already set up", status: 409 };
    }
    const operator: Operator = { id: crypto.randomUUID(), name: name.trim() };
    const { salt, hash } = hashPassphrase(passphrase);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO operator (id, name, pass_salt, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
      operator.id,
      operator.name,
      salt,
      hash,
      now,
    );
    const token = createSession(operator.id, now);
    db.exec("COMMIT");
    return { ok: true, operator, token };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function loginOperator(name: string, passphrase: string): { ok: true; operator: Operator; token: string } | { ok: false; error: string; setup?: boolean } {
  if (operatorCount() === 0) {
    dummyHash(passphrase);
    return { ok: false, error: "setup required", setup: true };
  }
  const row = yardDb()
    .prepare("SELECT id, name, pass_salt, pass_hash FROM operator WHERE name = ? COLLATE NOCASE")
    .get(name.trim()) as { id: string; name: string; pass_salt: Uint8Array; pass_hash: Uint8Array } | undefined;
  if (!row) {
    dummyHash(passphrase);
    return { ok: false, error: "invalid name or passphrase" };
  }
  if (!verifyPassphrase(passphrase, row.pass_salt, row.pass_hash)) {
    return { ok: false, error: "invalid name or passphrase" };
  }
  const token = createSession(row.id, new Date().toISOString());
  return { ok: true, operator: { id: row.id, name: row.name }, token };
}

export function logoutOperator(req: Request): void {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) {
    return;
  }
  yardDb().prepare("DELETE FROM operator_session WHERE token_hash = ?").run(tokenHash(token));
}

export function sessionCookieHeader(token: string, req: Request): string {
  return cookieHeader(SESSION_COOKIE, token, req, Math.floor(SESSION_ABS_MS / 1000));
}

export function clearSessionCookieHeader(req: Request): string {
  return cookieHeader(SESSION_COOKIE, "", req, 0);
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) {
    return null;
  }
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) {
      continue;
    }
    if (part.slice(0, eq).trim() !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}

function sessionOperator(token: string, touch: boolean): Operator | null {
  const row = yardDb()
    .prepare(
      `SELECT s.created_at, s.last_seen_at, o.id, o.name
       FROM operator_session s
       JOIN operator o ON o.id = s.operator_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token)) as { created_at: string; last_seen_at: string; id: string; name: string } | undefined;
  if (!row) {
    return null;
  }
  const now = Date.now();
  const created = Date.parse(row.created_at);
  const seen = Date.parse(row.last_seen_at);
  if (!Number.isFinite(created) || !Number.isFinite(seen)) {
    return null;
  }
  if (now - created > SESSION_ABS_MS || now - seen > SESSION_IDLE_MS) {
    yardDb().prepare("DELETE FROM operator_session WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  if (touch && now - seen > 60_000) {
    yardDb().prepare("UPDATE operator_session SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash(token));
  }
  return { id: row.id, name: row.name };
}

function createSession(operatorId: string, now: string): string {
  const token = randomBytes(32).toString("hex");
  yardDb()
    .prepare("INSERT INTO operator_session (token_hash, operator_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash(token), operatorId, now, now);
  return token;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassphrase(passphrase: string): { salt: Buffer; hash: Buffer } {
  const salt = randomBytes(16);
  const hash = scryptSync(passphrase, salt, HASH_LEN, SCRYPT);
  return { salt, hash };
}

function verifyPassphrase(passphrase: string, salt: Uint8Array, expected: Uint8Array): boolean {
  const hash = scryptSync(passphrase, Buffer.from(salt), HASH_LEN, SCRYPT);
  const want = Buffer.from(expected);
  if (hash.length !== want.length) {
    return false;
  }
  return timingSafeEqual(hash, want);
}

function dummyHash(passphrase: string): void {
  scryptSync(passphrase, DUMMY_SALT, HASH_LEN, SCRYPT);
}

function validateCredentials(name: string, passphrase: string): string | null {
  if (!NAME_RE.test(name.trim())) {
    return "name must be 2–32 letters, digits, dot, underscore, or hyphen";
  }
  if (passphrase.length < MIN_PASSPHRASE) {
    return `passphrase must be at least ${MIN_PASSPHRASE} characters`;
  }
  return null;
}

function cookieSecure(req: Request): boolean {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) {
    return xf.split(",")[0]?.trim() === "https";
  }
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function cookieHeader(name: string, value: string, req: Request, maxAge: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (cookieSecure(req)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
