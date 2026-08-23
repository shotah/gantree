import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { bindIsOpen, warnOpenBindIfEmpty, yardDb } from "./store";

export const SESSION_COOKIE = "gantree_session";
/** Idle window — bump last_seen on each gated request. */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** Absolute lifetime from login. Cookie Max-Age matches this. */
export const SESSION_ABS_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_PASSPHRASE = 10;
export const MAX_PASSPHRASE = 128;
/** Failed logins per name before that name is locked. */
export const LOGIN_FAIL_MAX = 8;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
/** Spray ceiling across all names. */
const LOGIN_FAIL_GLOBAL_MAX = 40;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const HASH_LEN = 32;
const DUMMY_SALT = Buffer.alloc(16, 7);
const DUMMY_INPUT = "x";

type FailBucket = { n: number; start: number; lockedUntil: number };
const loginFails = new Map<string, FailBucket>();
let loginFailsGlobal: FailBucket = { n: 0, start: 0, lockedUntil: 0 };

export type Operator = { id: string; name: string };

export type OperatorRow = Operator & { createdAt: string };

export type DoorStatus = {
  ready: boolean;
  operator: Operator | null;
  bindOpen: boolean;
};

export type DoorFail = { ok: false; error: string; status: number };

const NAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

type DevAttach = { operator: Operator; token: string } | null;
const devAttach = new WeakMap<Request, DevAttach>();
let warnedDevOn = false;
let warnedDevBind = false;
let warnedDevFail = false;

function envFlag(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Loopback-only. Compose sets HOST=0.0.0.0 — that never auto-logs in. */
export function devAutoLoginEnabled(): boolean {
  if (!envFlag(process.env.GANTREE_DEV)) {
    return false;
  }
  const name = (process.env.GANTREE_DEV_OPERATOR ?? "").trim();
  const passphrase = process.env.GANTREE_DEV_PASSPHRASE ?? "";
  if (!name || !passphrase) {
    return false;
  }
  if (bindIsOpen()) {
    if (!warnedDevBind) {
      warnedDevBind = true;
      console.warn("gantree: GANTREE_DEV ignored — HOST is not loopback.");
    }
    return false;
  }
  if (validateCredentials(name, passphrase)) {
    if (!warnedDevFail) {
      warnedDevFail = true;
      console.warn("gantree: GANTREE_DEV operator/passphrase failed validation (name 2–32, passphrase ≥10, not blank/common/your name).");
    }
    return false;
  }
  return true;
}

function attachDevSession(req: Request): DevAttach {
  if (devAttach.has(req)) {
    return devAttach.get(req) ?? null;
  }
  if (!devAutoLoginEnabled()) {
    devAttach.set(req, null);
    return null;
  }
  const name = (process.env.GANTREE_DEV_OPERATOR ?? "").trim();
  const passphrase = process.env.GANTREE_DEV_PASSPHRASE ?? "";
  let out: DevAttach = null;
  if (operatorCount() === 0) {
    const created = setupOperator(name, passphrase);
    if (created.ok) {
      out = { operator: created.operator, token: created.token };
    }
  } else {
    const login = loginOperator(name, passphrase);
    if (login.ok) {
      out = { operator: login.operator, token: login.token };
    } else {
      const added = addOperator(name, passphrase);
      if (added.ok) {
        const again = loginOperator(name, passphrase);
        if (again.ok) {
          out = { operator: again.operator, token: again.token };
        }
      }
    }
  }
  if (out && !warnedDevOn) {
    warnedDevOn = true;
    console.warn("gantree: GANTREE_DEV auto-login is on (loopback only). Unset it to photograph /login.");
  }
  if (!out && !warnedDevFail) {
    warnedDevFail = true;
    console.warn("gantree: GANTREE_DEV auto-login failed (name exists with a different passphrase?).");
  }
  devAttach.set(req, out);
  return out;
}

export function withDevSessionCookie(req: Request, res: Response): Response {
  const existing = readCookie(req, SESSION_COOKIE);
  if (existing && sessionOperator(existing, false)) {
    return res;
  }
  const attached = devAttach.get(req);
  if (!attached) {
    return res;
  }
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", sessionCookieHeader(attached.token, req));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function operatorCount(): number {
  const row = yardDb().prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function doorStatus(req: Request): DoorStatus {
  const operator = operatorFromRequest(req);
  const ready = operatorCount() > 0;
  warnOpenBindIfEmpty(!ready);
  return { ready, operator, bindOpen: bindIsOpen() };
}

export function denyUnlessOperator(req: Request): Response | null {
  operatorFromRequest(req, { touch: true });
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
      return withDevSessionCookie(req, blocked);
    }
    return withDevSessionCookie(req, await handler(req, ...args));
  };
}

export function operatorFromRequest(req: Request, opts?: { touch?: boolean }): Operator | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const op = sessionOperator(token, opts?.touch === true);
    if (op) {
      return op;
    }
  }
  return attachDevSession(req)?.operator ?? null;
}

export function setupOperator(name: string, passphrase: string): { ok: true; operator: Operator; token: string } | { ok: false; error: string; status: number } {
  if (typeof name !== "string" || typeof passphrase !== "string") {
    return { ok: false, error: "name and passphrase required", status: 400 };
  }
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

export function loginOperator(
  name: string,
  passphrase: string,
): { ok: true; operator: Operator; token: string } | { ok: false; error: string; setup?: boolean; status?: number } {
  if (operatorCount() === 0) {
    dummyHash(typeof passphrase === "string" && passphrase.length <= MAX_PASSPHRASE ? passphrase : DUMMY_INPUT);
    return { ok: false, error: "setup required", setup: true };
  }
  const label = typeof name === "string" ? name : "";
  if (loginLocked(label)) {
    return { ok: false, error: "too many attempts, try later", status: 429 };
  }
  if (typeof name !== "string" || typeof passphrase !== "string" || passphrase.length > MAX_PASSPHRASE) {
    dummyHash(DUMMY_INPUT);
    return finishLoginFail(label);
  }
  const row = yardDb()
    .prepare("SELECT id, name, pass_salt, pass_hash FROM operator WHERE name = ? COLLATE NOCASE")
    .get(name.trim()) as { id: string; name: string; pass_salt: Uint8Array; pass_hash: Uint8Array } | undefined;
  if (!row) {
    dummyHash(passphrase);
    return finishLoginFail(label);
  }
  if (!verifyPassphrase(passphrase, row.pass_salt, row.pass_hash)) {
    return finishLoginFail(label);
  }
  clearLoginFails(label);
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

export function listOperators(): OperatorRow[] {
  const rows = yardDb()
    .prepare("SELECT id, name, created_at FROM operator ORDER BY created_at, name")
    .all() as { id: string; name: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export function addOperator(name: string, passphrase: string): { ok: true; operator: OperatorRow } | DoorFail {
  if (typeof name !== "string" || typeof passphrase !== "string") {
    return { ok: false, error: "name and passphrase required", status: 400 };
  }
  const fields = validateCredentials(name, passphrase);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  const db = yardDb();
  const exists = db
    .prepare("SELECT id FROM operator WHERE name = ? COLLATE NOCASE")
    .get(name.trim()) as { id: string } | undefined;
  if (exists) {
    return { ok: false, error: "name already taken", status: 409 };
  }
  const operator: OperatorRow = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  const { salt, hash } = hashPassphrase(passphrase);
  db.prepare("INSERT INTO operator (id, name, pass_salt, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    operator.id,
    operator.name,
    salt,
    hash,
    operator.createdAt,
  );
  return { ok: true, operator };
}

export function removeOperator(_actorId: string, targetId: string): { ok: true } | DoorFail {
  const n = operatorCount();
  if (n <= 1) {
    return { ok: false, error: "cannot delete the last operator", status: 400 };
  }
  const db = yardDb();
  const hit = db.prepare("SELECT id FROM operator WHERE id = ?").get(targetId) as { id: string } | undefined;
  if (!hit) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  db.prepare("DELETE FROM operator WHERE id = ?").run(targetId);
  return { ok: true };
}

export function changeOwnPassphrase(
  operatorId: string,
  current: string,
  next: string,
  keepToken?: string,
): { ok: true } | DoorFail {
  if (typeof current !== "string" || typeof next !== "string") {
    return { ok: false, error: "current and next passphrase required", status: 400 };
  }
  const row = yardDb()
    .prepare("SELECT name, pass_salt, pass_hash FROM operator WHERE id = ?")
    .get(operatorId) as { name: string; pass_salt: Uint8Array; pass_hash: Uint8Array } | undefined;
  if (!row) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  const fields = validatePassphrase(next, row.name);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  if (!verifyPassphrase(current, row.pass_salt, row.pass_hash)) {
    dummyHash(next);
    return { ok: false, error: "current passphrase is wrong", status: 401 };
  }
  if (current === next) {
    dummyHash(next);
    return { ok: false, error: "choose a different passphrase", status: 400 };
  }
  const { salt, hash } = hashPassphrase(next);
  const db = yardDb();
  db.prepare("UPDATE operator SET pass_salt = ?, pass_hash = ? WHERE id = ?").run(salt, hash, operatorId);
  if (keepToken) {
    db.prepare("DELETE FROM operator_session WHERE operator_id = ? AND token_hash != ?").run(operatorId, tokenHash(keepToken));
  } else {
    db.prepare("DELETE FROM operator_session WHERE operator_id = ?").run(operatorId);
  }
  return { ok: true };
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
  const input = passphrase.length <= MAX_PASSPHRASE ? passphrase : DUMMY_INPUT;
  scryptSync(input, DUMMY_SALT, HASH_LEN, SCRYPT);
}

/** JSON body for /api/login and /api/setup. Rejects null, numbers, arrays. */
export function doorAuthBody(body: unknown): { name: string; passphrase: string } | { error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: "name and passphrase required" };
  }
  const rec = body as Record<string, unknown>;
  if (typeof rec.name !== "string" || typeof rec.passphrase !== "string") {
    return { error: "name and passphrase required" };
  }
  return { name: rec.name, passphrase: rec.passphrase };
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

function validateCredentials(name: string, passphrase: string): string | null {
  if (!NAME_RE.test(name.trim())) {
    return "name must be 2–32 letters, digits, dot, underscore, or hyphen";
  }
  return validatePassphrase(passphrase, name);
}

function validatePassphrase(passphrase: string, name: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE) {
    return `passphrase must be at least ${MIN_PASSPHRASE} characters`;
  }
  if (passphrase.length > MAX_PASSPHRASE) {
    return `passphrase must be at most ${MAX_PASSPHRASE} characters`;
  }
  if (!passphrase.trim()) {
    return "passphrase cannot be empty";
  }
  const n = name.trim().toLowerCase();
  const p = passphrase.toLowerCase();
  const stripped = p.replace(/[\s._-]/g, "");
  if (n && (p === n || (n.length >= 2 && stripped.length >= MIN_PASSPHRASE && stripped.replaceAll(n, "") === ""))) {
    return "passphrase cannot be your name";
  }
  if (new Set(passphrase).size < 4 || /^\d+$/.test(passphrase) || STUPID.has(p) || STUPID.has(stripped) || trivialPattern(p)) {
    return "passphrase is too common or too simple";
  }
  return null;
}

const STUPID = new Set([
  "null",
  "undefined",
  "none",
  "nil",
  "true",
  "false",
  "password123",
  "password12",
  "password1!",
  "password1234",
  "password12!",
  "passwordpassword",
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "abcdefghij",
  "1q2w3e4r5t",
  "1qaz2wsx3e",
  "adminadmin",
  "admin12345",
  "admin123456",
  "letmein123",
  "letmein1234",
  "welcome123",
  "welcome1234",
  "passw0rd12",
  "passw0rd123",
  "passw0rd!",
  "p@ssw0rd12",
  "p@ssw0rd123",
  "p@ssword1",
  "iloveyou123",
  "monkey1234",
  "dragon1234",
  "baseball123",
  "football123",
  "sunshine123",
  "princess123",
  "starwars123",
  "changeme123",
  "trustno1!!",
  "0000000000",
  "1111111111",
  "aaaaaaaaaa",
  "abc1234567",
  "qwertyqwerty",
  "rootrootroot",
  "gantree123",
  "gantry1234",
  "testtest12",
  "guestguest1",
]);

function trivialPattern(p: string): boolean {
  if (/^password\d*!*$/.test(p)) {
    return true;
  }
  if (/^(welcome|admin|letmein|qwerty|passw0rd|changeme|gantree|gantry)\d*!*$/.test(p)) {
    return true;
  }
  if (/^(spring|summer|autumn|fall|winter)\d{2,4}!*$/.test(p)) {
    return true;
  }
  const compact = p.replace(/[^a-z0-9]/g, "");
  const runs = [
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "0123456789",
    "9876543210",
    "qwertyuiopasdfghjkl",
    "qwertyuiop",
  ];
  return compact.length >= 8 && runs.some((run) => run.includes(compact));
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
