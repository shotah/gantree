import { bindIsOpen, closeYardDb, dbPath, warnOpenBindIfEmpty, yardDb } from "@/lib/yard/door/store";
import {
  MIN_PASSPHRASE,
  SESSION_ABS_MS,
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  addOperator,
  changeOwnPassphrase,
  clearSessionCookieHeader,
  denyUnlessOperator,
  doorStatus,
  listOperators,
  loginOperator,
  logoutOperator,
  operatorCount,
  operatorFromRequest,
  removeOperator,
  sessionCookieHeader,
  setupOperator,
  withDoor,
} from "@/lib/yard/door/gate";
import { listYardEvents, recordFromRequest, recordYardEvent } from "@/lib/yard/door/events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "gantree-door-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_DB = join(root, "gantree.db");
  delete process.env.HOST;
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_DB;
  delete process.env.HOST;
});

function req(path = "/api/gantries", cookie?: string): Request {
  const url = path.startsWith("http") ? path : `http://127.0.0.1${path}`;
  return new Request(url, cookie ? { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } } : undefined);
}

describe("yard sqlite", () => {
  it("opens WAL gantree.db next to the yard, not a crane gantry.db", () => {
    yardDb();
    expect(dbPath()).toMatch(/gantree\.db$/);
    expect(dbPath()).not.toContain("gantries");
    const mode = yardDb().prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(mode.journal_mode.toLowerCase()).toBe("wal");
  });

  it("creates operator, session, and yard_event tables", () => {
    const names = yardDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    expect(names.map((n) => n.name)).toEqual([
      "operator",
      "operator_session",
      "sample_host",
      "sample_mcp",
      "sample_turn",
      "sample_uptime",
      "yard_event",
    ]);
  });

  it("mkdirs the db directory", () => {
    const nested = join(process.env.GANTREE_DB!, "..", "nested", "gantree.db");
    process.env.GANTREE_DB = nested;
    closeYardDb();
    mkdirSync(join(nested, ".."), { recursive: true });
    yardDb();
    expect(operatorCount()).toBe(0);
  });
});

describe("setup and login", () => {
  it("creates the first operator and a session", () => {
    const out = setupOperator("kit", "a-long-enough-pass");
    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    expect(out.operator.name).toBe("kit");
    expect(operatorCount()).toBe(1);
    expect(operatorFromRequest(req("/api/door", out.token))?.name).toBe("kit");
    const dump = readFileSync(dbPath());
    expect(dump.includes("a-long-enough-pass")).toBe(false);
    expect(dump.includes(out.token)).toBe(false);
  });

  it("refuses a second setup", () => {
    expect(setupOperator("kit", "a-long-enough-pass").ok).toBe(true);
    const again = setupOperator("other", "a-long-enough-pass");
    expect(again).toEqual({ ok: false, error: "already set up", status: 409 });
  });

  it("rejects short passphrases and bad names without writing", () => {
    expect(setupOperator("kit", "short").ok).toBe(false);
    expect(setupOperator("no spaces", "a-long-enough-pass").ok).toBe(false);
    expect(operatorCount()).toBe(0);
    expect(MIN_PASSPHRASE).toBe(10);
  });

  it("uses the same error for unknown names and bad passphrases", () => {
    setupOperator("kit", "a-long-enough-pass");
    const unknown = loginOperator("nope", "a-long-enough-pass");
    const bad = loginOperator("kit", "wrong-passphrase-here");
    expect(unknown.ok).toBe(false);
    expect(bad.ok).toBe(false);
    if (unknown.ok || bad.ok) {
      return;
    }
    expect(unknown.error).toBe("invalid name or passphrase");
    expect(bad.error).toBe(unknown.error);
    expect("setup" in unknown).toBe(false);
  });

  it("logs in case-insensitively and logs out", () => {
    setupOperator("Kit", "a-long-enough-pass");
    const login = loginOperator("kit", "a-long-enough-pass");
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }
    const authed = req("http://127.0.0.1/api/gantries", login.token);
    expect(operatorFromRequest(authed)?.name).toBe("Kit");
    logoutOperator(authed);
    expect(operatorFromRequest(authed)).toBeNull();
  });

  it("points at setup when the db is empty", () => {
    const login = loginOperator("kit", "a-long-enough-pass");
    expect(login).toMatchObject({ ok: false, setup: true });
  });
});

describe("the door", () => {
  it("401s list/recreate/env without a session, with setup: true when empty", async () => {
    const empty = denyUnlessOperator(req());
    expect(empty?.status).toBe(401);
    expect(empty ? await empty.json() : null).toEqual({ error: "setup required", setup: true });

    setupOperator("kit", "a-long-enough-pass");
    const locked = denyUnlessOperator(req());
    expect(locked?.status).toBe(401);
    expect(locked ? await locked.json() : null).toEqual({ error: "unauthorized" });
  });

  it("lets a logged-in operator through withDoor", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const handler = withDoor(async () => Response.json({ ok: true }));
    const denied = await handler(req());
    expect(denied.status).toBe(401);
    const allowed = await handler(req("http://127.0.0.1/api/gantries", created.token));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ ok: true });
  });

  it("reports door status without leaking other operators", () => {
    const empty = doorStatus(req());
    expect(empty).toEqual({ ready: false, operator: null, bindOpen: false });
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(doorStatus(req()).ready).toBe(true);
    expect(doorStatus(req()).operator).toBeNull();
    expect(doorStatus(req("http://127.0.0.1/api/door", created.token)).operator).toEqual({
      id: created.operator.id,
      name: "kit",
    });
  });

  it("drops idle and absolute sessions", () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const hash = yardDb().prepare("SELECT token_hash FROM operator_session").get() as { token_hash: string };
    const stale = new Date(Date.now() - SESSION_IDLE_MS - 1000).toISOString();
    yardDb().prepare("UPDATE operator_session SET last_seen_at = ? WHERE token_hash = ?").run(stale, hash.token_hash);
    expect(operatorFromRequest(req("http://127.0.0.1/", created.token))).toBeNull();

    const again = loginOperator("kit", "a-long-enough-pass");
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    const abs = new Date(Date.now() - SESSION_ABS_MS - 1000).toISOString();
    const row = yardDb().prepare("SELECT token_hash FROM operator_session ORDER BY created_at DESC LIMIT 1").get() as {
      token_hash: string;
    };
    yardDb().prepare("UPDATE operator_session SET created_at = ? WHERE token_hash = ?").run(abs, row.token_hash);
    expect(operatorFromRequest(req("http://127.0.0.1/", again.token))).toBeNull();
  });

  it("sets Secure cookies on https and ignores a missing logout cookie", () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const httpsReq = new Request("https://yard.example/api/gantries");
    expect(sessionCookieHeader(created.token, httpsReq)).toMatch(/Secure/);
    expect(clearSessionCookieHeader(httpsReq)).toMatch(/Max-Age=0/);
    const xf = new Request("http://yard.example/api/gantries", { headers: { "x-forwarded-proto": "https" } });
    expect(sessionCookieHeader(created.token, xf)).toMatch(/Secure/);
    logoutOperator(req());
    const authed = req("http://127.0.0.1/api/gantries", created.token);
    expect(operatorFromRequest(authed, { touch: true })?.name).toBe("kit");
  });
});

describe("open bind", () => {
  it("warns once when listening on all interfaces with no operators", () => {
    process.env.HOST = "0.0.0.0";
    expect(bindIsOpen()).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnOpenBindIfEmpty(true);
    warnOpenBindIfEmpty(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(doorStatus(req()).bindOpen).toBe(true);
    warn.mockRestore();
  });
});

describe("operators", () => {
  it("adds a partner, lists names without hashes, and refuses the last delete", () => {
    const first = setupOperator("kit", "a-long-enough-pass");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const added = addOperator("partner", "another-long-pass");
    expect(added.ok).toBe(true);
    const listed = listOperators();
    expect(listed.map((o) => o.name).sort()).toEqual(["kit", "partner"]);
    const dump = readFileSync(dbPath());
    expect(dump.includes("another-long-pass")).toBe(false);

    expect(removeOperator(first.operator.id, "missing").ok).toBe(false);
    expect(addOperator("kit", "a-long-enough-pass")).toMatchObject({ ok: false, status: 409 });

    if (!added.ok) {
      return;
    }
    expect(removeOperator(first.operator.id, added.operator.id).ok).toBe(true);
    expect(listOperators()).toHaveLength(1);
    expect(removeOperator(first.operator.id, first.operator.id)).toMatchObject({
      ok: false,
      error: "cannot delete the last operator",
    });
  });

  it("drops the partner session after remove and changes own passphrase", () => {
    const first = setupOperator("kit", "a-long-enough-pass");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const added = addOperator("partner", "another-long-pass");
    expect(added.ok).toBe(true);
    const login = loginOperator("partner", "another-long-pass");
    expect(login.ok).toBe(true);
    if (!login.ok || !added.ok) {
      return;
    }
    const partnerReq = req("http://127.0.0.1/api/gantries", login.token);
    expect(operatorFromRequest(partnerReq)?.name).toBe("partner");
    expect(removeOperator(first.operator.id, added.operator.id).ok).toBe(true);
    expect(operatorFromRequest(partnerReq)).toBeNull();

    expect(changeOwnPassphrase(first.operator.id, "wrong-passphrase-here", "brand-new-pass").ok).toBe(false);
    expect(changeOwnPassphrase(first.operator.id, "a-long-enough-pass", "short").ok).toBe(false);
    expect(changeOwnPassphrase(first.operator.id, "a-long-enough-pass", "brand-new-pass").ok).toBe(true);
    expect(loginOperator("kit", "a-long-enough-pass").ok).toBe(false);
    expect(loginOperator("kit", "brand-new-pass").ok).toBe(true);
  });
});

describe("audit", () => {
  it("records who did what and 401s the events list without a session", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    recordYardEvent({ kind: "setup", operatorId: created.operator.id, detail: "kit" });
    const authed = req("http://127.0.0.1/api/gantries", created.token);
    recordFromRequest(authed, "recreate", "kit", "doctor ok");
    const events = listYardEvents({ slug: "kit", limit: 10 });
    expect(events[0]?.kind).toBe("recreate");
    expect(events[0]?.operatorName).toBe("kit");
    expect(listYardEvents()[1]?.kind).toBe("setup");

    const handler = withDoor(async () => Response.json({ events: listYardEvents() }));
    expect((await handler(req())).status).toBe(401);
    expect((await handler(authed)).status).toBe(200);
  });
});
