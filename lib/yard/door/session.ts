import { createHash, randomBytes } from "node:crypto";
import { dummyHash, dummyInput, MAX_PASSPHRASE, verifyPassphrase } from "./pass";
import { publicOperator, type Operator } from "./shape";
import { yardDb } from "./store";

export const SESSION_COOKIE = "gantree_session";
/** Idle window — bump last_seen on each gated request. */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** Absolute lifetime from login. Cookie Max-Age matches this. */
export const SESSION_ABS_MS = 30 * 24 * 60 * 60 * 1000;
/** Failed logins per name before that name is locked. */
export const LOGIN_FAIL_MAX = 8;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
/** Spray ceiling across all names. */
const LOGIN_FAIL_GLOBAL_MAX = 40;

type FailBucket = { n: number; start: number; lockedUntil: number };
const loginFails = new Map<string, FailBucket>();
let loginFailsGlobal: FailBucket = { n: 0, start: 0, lockedUntil: 0 };

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(operatorId: string, now: string): string {
  const token = randomBytes(32).toString("hex");
  yardDb()
    .prepare("INSERT INTO operator_session (token_hash, operator_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash(token), operatorId, now, now);
  return token;
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

export function sessionOperator(token: string, touch: boolean): Operator | null {
  const row = yardDb()
    .prepare(
      `SELECT s.created_at, s.last_seen_at, o.id, o.name, o.display_name, o.role, o.crane_slug
       FROM operator_session s
       JOIN operator o ON o.id = s.operator_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token)) as
    | {
      created_at: string;
      last_seen_at: string;
      id: string;
      name: string;
      display_name: string | null;
      role: string | null;
      crane_slug: string | null;
    }
    | undefined;
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
  return publicOperator(row);
}

export function loginOperator(
  name: string,
  passphrase: string,
): { ok: true; operator: Operator; token: string } | { ok: false; error: string; setup?: boolean; status?: number } {
  const n = Number((yardDb().prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined)?.n ?? 0);
  if (n === 0) {
    dummyHash(typeof passphrase === "string" && passphrase.length <= MAX_PASSPHRASE ? passphrase : dummyInput());
    return { ok: false, error: "setup required", setup: true };
  }
  const label = typeof name === "string" ? name : "";
  if (loginLocked(label)) {
    return { ok: false, error: "too many attempts, try later", status: 429 };
  }
  if (typeof name !== "string" || typeof passphrase !== "string" || passphrase.length > MAX_PASSPHRASE) {
    dummyHash(dummyInput());
    return finishLoginFail(label);
  }
  const row = yardDb()
    .prepare(
      "SELECT id, name, display_name, role, crane_slug, pass_salt, pass_hash FROM operator WHERE name = ? COLLATE NOCASE",
    )
    .get(name.trim()) as
    | {
      id: string;
      name: string;
      display_name: string | null;
      role: string | null;
      crane_slug: string | null;
      pass_salt: Uint8Array;
      pass_hash: Uint8Array;
    }
    | undefined;
  if (!row) {
    dummyHash(passphrase);
    return finishLoginFail(label);
  }
  if (!verifyPassphrase(passphrase, row.pass_salt, row.pass_hash)) {
    return finishLoginFail(label);
  }
  clearLoginFails(label);
  const token = createSession(row.id, new Date().toISOString());
  return { ok: true, operator: publicOperator(row), token };
}

export function logoutOperator(req: Request): Operator | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  const you = sessionOperator(token, false);
  yardDb().prepare("DELETE FROM operator_session WHERE token_hash = ?").run(tokenHash(token));
  return you;
}

export function resetLoginThrottle(): void {
  loginFails.clear();
  loginFailsGlobal = { n: 0, start: 0, lockedUntil: 0 };
}

function failKey(name: string): string {
  return name.trim().toLowerCase();
}

function bucketLocked(b: FailBucket, now: number): boolean {
  return now < b.lockedUntil;
}

function touchFail(b: FailBucket, now: number, max: number): FailBucket {
  if (b.start === 0 || now - b.start > LOGIN_FAIL_WINDOW_MS) {
    b = { n: 0, start: now, lockedUntil: 0 };
  }
  if (now < b.lockedUntil) {
    return b;
  }
  b.n += 1;
  if (b.n >= max) {
    b.lockedUntil = now + LOGIN_FAIL_WINDOW_MS;
  }
  return b;
}

function loginLocked(name: string): boolean {
  const now = Date.now();
  if (bucketLocked(loginFailsGlobal, now)) {
    return true;
  }
  const b = loginFails.get(failKey(name));
  return Boolean(b && bucketLocked(b, now));
}

function finishLoginFail(name: string): { ok: false; error: string; status?: number } {
  const now = Date.now();
  const key = failKey(name);
  let b = loginFails.get(key) ?? { n: 0, start: now, lockedUntil: 0 };
  b = touchFail(b, now, LOGIN_FAIL_MAX);
  loginFails.set(key, b);
  if (loginFails.size > 500) {
    const first = loginFails.keys().next().value;
    if (first !== undefined) {
      loginFails.delete(first);
    }
  }
  loginFailsGlobal = touchFail(loginFailsGlobal, now, LOGIN_FAIL_GLOBAL_MAX);
  if (bucketLocked(b, now) || bucketLocked(loginFailsGlobal, now)) {
    return { ok: false, error: "too many attempts, try later", status: 429 };
  }
  return { ok: false, error: "invalid name or passphrase" };
}

function clearLoginFails(name: string): void {
  loginFails.delete(failKey(name));
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
