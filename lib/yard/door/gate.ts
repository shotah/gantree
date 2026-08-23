import { canManageOperators, canMutateCrane, canReadCrane } from "./access";
import { addOperator, operatorCount, setupOperator } from "./operators";
import { validateCredentials } from "./pass";
import {
  loginOperator,
  readCookie,
  SESSION_COOKIE,
  sessionCookieHeader,
  sessionOperator,
} from "./session";
import type { DoorStatus, Operator } from "./shape";
import { bindIsOpen, warnOpenBindIfEmpty } from "./store";

export {
  LOGIN_FAIL_MAX,
  LOGIN_FAIL_WINDOW_MS,
  SESSION_ABS_MS,
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  clearSessionCookieHeader,
  loginOperator,
  logoutOperator,
  readCookie,
  resetLoginThrottle,
  sessionCookieHeader,
} from "./session";
export { MAX_PASSPHRASE, MIN_PASSPHRASE } from "./pass";
export {
  addOperator,
  changeOwnPassphrase,
  getOperator,
  listOperators,
  operatorCount,
  removeOperator,
  setOperatorAccess,
  setupOperator,
  unassignCrane,
  updateOwnProfile,
} from "./operators";
export type { DoorFail, DoorStatus, Operator, OperatorProfilePatch, OperatorRow } from "./shape";

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

export function doorStatus(req: Request): DoorStatus {
  const operator = operatorFromRequest(req);
  const ready = operatorCount() > 0;
  warnOpenBindIfEmpty(!ready);
  return { ready, operator, bindOpen: bindIsOpen(), dev: devAutoLoginEnabled() };
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

export function denyUnlessAdmin(req: Request): Response | null {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageOperators(you)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export function denyUnlessCraneRead(req: Request, slug: string): Response | null {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canReadCrane(you, slug)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return null;
}

export function denyUnlessCraneMutate(req: Request, slug: string): Response | null {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canReadCrane(you, slug)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (!canMutateCrane(you, slug)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
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
