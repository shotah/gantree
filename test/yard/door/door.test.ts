import { bindIsOpen, closeYardDb, dbPath, warnOpenBindIfEmpty, yardDb } from "@/lib/yard/door/store";
import {
  LOGIN_FAIL_MAX,
  MAX_PASSPHRASE,
  MIN_PASSPHRASE,
  SESSION_ABS_MS,
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  addOperator,
  changeOwnPassphrase,
  clearSessionCookieHeader,
  denyUnlessAdmin,
  denyUnlessCraneMutate,
  denyUnlessCraneRead,
  denyUnlessOperator,
  devAutoLoginEnabled,
  doorAuthBody,
  doorStatus,
  listOperators,
  loginOperator,
  logoutOperator,
  operatorCount,
  operatorFromRequest,
  getOperator,
  removeOperator,
  resetLoginThrottle,
  sessionCookieHeader,
  setOperatorAccess,
  setupOperator,
  unassignCrane,
  updateOwnProfile,
  withDevSessionCookie,
  withDoor,
} from "@/lib/yard/door/gate";
import { listYardEvents, recordFromRequest, recordYardEvent } from "@/lib/yard/door/events";
import { readOperatorAvatar, saveOperatorAvatar } from "@/lib/yard/door/profile";
import { GET as listEvents } from "@/app/api/events/route";
import { POST as postLogin } from "@/app/api/login/route";
import { POST as postLogout } from "@/app/api/logout/route";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dirs: string[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "gantree-door-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_DB = join(root, "gantree.db");
  delete process.env.HOST;
  delete process.env.GANTREE_DEV;
  delete process.env.GANTREE_DEV_OPERATOR;
  delete process.env.GANTREE_DEV_PASSPHRASE;
  resetLoginThrottle();
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_DB;
  delete process.env.HOST;
  delete process.env.GANTREE_DEV;
  delete process.env.GANTREE_DEV_OPERATOR;
  delete process.env.GANTREE_DEV_PASSPHRASE;
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
      "sample_machine",
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
    expect(out.operator.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
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
    expect(MAX_PASSPHRASE).toBe(128);
  });

  it("rejects null, empty, common, and name-shaped passphrases", () => {
    expect(doorAuthBody(null)).toEqual({ error: "name and passphrase required" });
    expect(doorAuthBody({ name: "kit", passphrase: null })).toEqual({ error: "name and passphrase required" });
    expect(doorAuthBody({ name: "kit", passphrase: 1234567890 })).toEqual({ error: "name and passphrase required" });
    expect(doorAuthBody({ name: ["kit"], passphrase: "a-long-enough-pass" })).toEqual({
      error: "name and passphrase required",
    });
    expect(doorAuthBody({ name: "kit", passphrase: "a-long-enough-pass" })).toEqual({
      name: "kit",
      passphrase: "a-long-enough-pass",
    });

    expect(setupOperator("kit", "          ").ok).toBe(false);
    expect(setupOperator("kit", "null      ").ok).toBe(false);
    expect(setupOperator("kit", "none      ").ok).toBe(false);
    expect(setupOperator("kit", "nullnullnull").ok).toBe(false);
    expect(setupOperator("kit", "password123").ok).toBe(false);
    expect(setupOperator("kit", "1234567890").ok).toBe(false);
    expect(setupOperator("kit", "aaaaaaaaaa").ok).toBe(false);
    expect(setupOperator("kit", "abcdefghij").ok).toBe(false);
    expect(setupOperator("kit", "kitkitkitkit").ok).toBe(false);
    expect(setupOperator("kit", "a".repeat(MAX_PASSPHRASE + 1)).ok).toBe(false);
    expect(operatorCount()).toBe(0);
    expect(setupOperator("kit", "a-long-enough-pass").ok).toBe(true);
    expect(loginOperator("kit", "").ok).toBe(false);
    expect(loginOperator("kit", "x".repeat(MAX_PASSPHRASE + 1)).ok).toBe(false);
    expect(loginOperator("kit", "a-long-enough-pass").ok).toBe(true);
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

  it("backs off after repeated failed logins, even with the right passphrase", () => {
    expect(setupOperator("kit", "a-long-enough-pass").ok).toBe(true);
    for (let i = 0; i < LOGIN_FAIL_MAX - 1; i++) {
      const miss = loginOperator("kit", "wrong-passphrase-here");
      expect(miss.ok).toBe(false);
      if (!miss.ok) {
        expect(miss.error).toBe("invalid name or passphrase");
        expect(miss.status).toBeUndefined();
      }
    }
    const locked = loginOperator("kit", "wrong-passphrase-here");
    expect(locked).toMatchObject({ ok: false, error: "too many attempts, try later", status: 429 });
    const evenRight = loginOperator("kit", "a-long-enough-pass");
    expect(evenRight).toMatchObject({ ok: false, status: 429 });
    const unknown = loginOperator("nope", "wrong-passphrase-here");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error).toBe("invalid name or passphrase");
    }
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
    expect(empty).toEqual({ ready: false, operator: null, bindOpen: false, dev: false });
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
      displayName: "kit",
      role: "admin",
      cranes: [],
      avatarRev: null,
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
    expect(changeOwnPassphrase(first.operator.id, "a-long-enough-pass", "password123").ok).toBe(false);
    expect(changeOwnPassphrase(first.operator.id, "a-long-enough-pass", "a-long-enough-pass").ok).toBe(false);

    const other = loginOperator("kit", "a-long-enough-pass");
    expect(other.ok).toBe(true);
    if (!other.ok) {
      return;
    }
    expect(changeOwnPassphrase(first.operator.id, "a-long-enough-pass", "brand-new-pass", other.token).ok).toBe(true);
    expect(operatorFromRequest(req("http://127.0.0.1/api/gantries", first.token))).toBeNull();
    expect(operatorFromRequest(req("http://127.0.0.1/api/gantries", other.token))?.name).toBe("kit");
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
    recordYardEvent({ kind: "grant", slug: "jules", operatorId: created.operator.id, detail: "math" });
    const events = listYardEvents({ slug: "kit", limit: 10 });
    expect(events.map((e) => e.kind)).toEqual(["recreate"]);
    expect(events[0]?.operatorName).toBe("kit");
    expect(listYardEvents({ slug: "jules" }).map((e) => e.kind)).toEqual(["grant"]);
    expect(listYardEvents().map((e) => e.kind)).toEqual(["grant", "recreate", "setup"]);
    expect(listYardEvents({ kind: "recreate" }).map((e) => e.kind)).toEqual(["recreate"]);

    const handler = withDoor(async () => Response.json({ events: listYardEvents() }));
    expect((await handler(req())).status).toBe(401);
    expect((await handler(authed)).status).toBe(200);
  });

  it("records login and logout for admin, and hides them from other operators", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const user = addOperator("ada", "a-long-enough-pass", "user", "kit");
    expect(user.ok).toBe(true);
    if (!user.ok) {
      return;
    }

    const miss = await postLogin(
      new Request("http://127.0.0.1/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "ada", passphrase: "wrong-passphrase-here" }),
      }),
    );
    expect(miss.status).toBe(401);
    expect(listYardEvents().map((e) => e.kind)).not.toContain("login");

    const loginRes = await postLogin(
      new Request("http://127.0.0.1/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "ada", passphrase: "a-long-enough-pass" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const token = (loginRes.headers.get("set-cookie") ?? "").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
    expect(token).toBeTruthy();

    recordYardEvent({ kind: "recreate", slug: "kit", operatorId: created.operator.id });

    const logoutRes = await postLogout(
      new Request("http://127.0.0.1/api/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(logoutRes.status).toBe(200);
    expect(listYardEvents().map((e) => e.kind)).toEqual(["logout", "recreate", "login"]);
    expect(listYardEvents({ includeSession: false }).map((e) => e.kind)).toEqual(["recreate"]);

    const adminList = await listEvents(req("http://127.0.0.1/api/events", created.token));
    expect(adminList.status).toBe(200);
    const adminKinds = ((await adminList.json()) as { events: { kind: string }[] }).events.map((e) => e.kind);
    expect(adminKinds).toEqual(["logout", "recreate", "login"]);

    const jsonl = await listEvents(req("http://127.0.0.1/api/events?format=jsonl", created.token));
    expect(jsonl.status).toBe(200);
    expect(jsonl.headers.get("content-type")).toMatch(/ndjson/);
    expect(await jsonl.text()).toContain('"kind":"recreate"');

    const ada = loginOperator("ada", "a-long-enough-pass");
    expect(ada.ok).toBe(true);
    if (!ada.ok) {
      return;
    }
    const adaList = await listEvents(req("http://127.0.0.1/api/events", ada.token));
    expect(adaList.status).toBe(200);
    const adaKinds = ((await adaList.json()) as { events: { kind: string }[] }).events.map((e) => e.kind);
    expect(adaKinds).toEqual(["recreate"]);
    const peek = await listEvents(req("http://127.0.0.1/api/events?kind=login", ada.token));
    expect(((await peek.json()) as { events: unknown[] }).events).toEqual([]);
  });
});

describe("dev auto-login", () => {
  function enableBob() {
    process.env.GANTREE_DEV = "1";
    process.env.GANTREE_DEV_OPERATOR = "bob";
    process.env.GANTREE_DEV_PASSPHRASE = "bob-dev-ok";
  }

  it("sets up bob on loopback, gates APIs, and never stores the passphrase", async () => {
    enableBob();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(devAutoLoginEnabled()).toBe(true);
    const incoming = req("/api/door");
    const status = doorStatus(incoming);
    expect(status.ready).toBe(true);
    expect(status.dev).toBe(true);
    expect(status.operator?.name).toBe("bob");
    const cooked = withDevSessionCookie(incoming, Response.json(status));
    expect(cooked.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=`));

    const handler = withDoor(async () => Response.json({ ok: true }));
    expect((await handler(req())).status).toBe(200);
    expect(operatorCount()).toBe(1);
    expect(readFileSync(dbPath()).includes("bob-dev-ok")).toBe(false);
    warn.mockRestore();
  });

  it("is ignored when bound on all interfaces", async () => {
    enableBob();
    process.env.HOST = "0.0.0.0";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(devAutoLoginEnabled()).toBe(false);
    expect(doorStatus(req()).dev).toBe(false);
    expect(denyUnlessOperator(req())?.status).toBe(401);
    expect(operatorCount()).toBe(0);
    warn.mockRestore();
  });

  it("rejects a short passphrase like setup does", () => {
    process.env.GANTREE_DEV = "1";
    process.env.GANTREE_DEV_OPERATOR = "bob";
    process.env.GANTREE_DEV_PASSPHRASE = "bob";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(devAutoLoginEnabled()).toBe(false);
    warn.mockRestore();
  });

  it("logs in an existing operator with the env passphrase", async () => {
    expect(setupOperator("bob", "bob-dev-ok").ok).toBe(true);
    enableBob();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const incoming = req();
    const handler = withDoor(async (r) => Response.json({ me: operatorFromRequest(r)?.name }));
    const res = await handler(incoming);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ me: "bob" });
    warn.mockRestore();
  });
});

describe("roles", () => {
  const pass = "a-long-enough-pass";

  it("setup is admin, user and readonly need a crane, readonly cannot mutate", async () => {
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.operator.role).toBe("admin");
    expect(addOperator("ada", pass, "user")).toMatchObject({ ok: false, status: 400 });
    expect(addOperator("look", pass, "readonly")).toMatchObject({ ok: false, status: 400 });
    const user = addOperator("ada", pass, "user", "kit");
    expect(user.ok).toBe(true);
    if (!user.ok) {
      return;
    }
    expect(user.operator).toMatchObject({ role: "user", cranes: ["kit"] });
    const reader = addOperator("look", pass, "readonly", "kit");
    expect(reader.ok).toBe(true);
    if (!reader.ok) {
      return;
    }
    expect(reader.operator).toMatchObject({ role: "readonly", cranes: ["kit"] });

    const ada = loginOperator("ada", pass);
    const look = loginOperator("look", pass);
    expect(ada.ok && look.ok).toBe(true);
    if (!ada.ok || !look.ok) {
      return;
    }
    const adaReq = req("http://127.0.0.1/api/gantries/kit", ada.token);
    const lookReq = req("http://127.0.0.1/api/gantries/kit", look.token);
    expect(denyUnlessCraneRead(adaReq, "kit")).toBeNull();
    expect(denyUnlessCraneMutate(adaReq, "kit")).toBeNull();
    expect(denyUnlessCraneRead(adaReq, "tryout")?.status).toBe(404);
    expect(denyUnlessCraneMutate(lookReq, "kit")?.status).toBe(403);
    expect(denyUnlessCraneRead(lookReq, "tryout")?.status).toBe(404);
    expect(denyUnlessAdmin(adaReq)?.status).toBe(403);
    expect(denyUnlessAdmin(req("http://127.0.0.1/api/operators", first.token))).toBeNull();

    recordYardEvent({ kind: "recreate", slug: "kit", operatorId: first.operator.id });
    recordYardEvent({ kind: "grant", slug: "tryout", operatorId: first.operator.id });
    const adaEvents = await listEvents(req("http://127.0.0.1/api/events", ada.token));
    expect(adaEvents.status).toBe(200);
    const adaBody = (await adaEvents.json()) as { events: { slug: string | null }[] };
    expect(adaBody.events.map((e) => e.slug)).toEqual(["kit"]);
    const peekTryout = await listEvents(req("http://127.0.0.1/api/events?slug=tryout", ada.token));
    expect(peekTryout.status).toBe(404);
  });

  it("lets a user hold more than one crane", async () => {
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const pair = addOperator("ada", pass, "user", ["kit", "tryout"]);
    expect(pair.ok).toBe(true);
    if (!pair.ok) {
      return;
    }
    expect(pair.operator).toMatchObject({ role: "user", cranes: ["kit", "tryout"] });
    const login = loginOperator("ada", pass);
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }
    const pairReq = req("http://127.0.0.1/api/gantries/kit", login.token);
    expect(denyUnlessCraneRead(pairReq, "kit")).toBeNull();
    expect(denyUnlessCraneMutate(pairReq, "tryout")).toBeNull();
    expect(denyUnlessCraneRead(pairReq, "jules")?.status).toBe(404);
    recordYardEvent({ kind: "recreate", slug: "kit", operatorId: first.operator.id });
    recordYardEvent({ kind: "recreate", slug: "tryout", operatorId: first.operator.id });
    recordYardEvent({ kind: "grant", slug: "jules", operatorId: first.operator.id });
    const listed = await listEvents(req("http://127.0.0.1/api/events", login.token));
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { events: { slug: string | null }[] };
    expect(body.events.map((e) => e.slug).sort()).toEqual(["kit", "tryout"]);
  });

  it("unassigns a destroyed slug and allows an empty crane list", () => {
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const pair = addOperator("ada", pass, "user", ["kit", "tryout"]);
    const look = addOperator("look", pass, "readonly", "kit");
    expect(pair.ok && look.ok).toBe(true);
    if (!pair.ok || !look.ok) {
      return;
    }
    expect(unassignCrane("kit")).toBe(2);
    expect(getOperator(pair.operator.id)?.cranes).toEqual(["tryout"]);
    expect(getOperator(look.operator.id)?.cranes).toEqual([]);
    expect(unassignCrane("tryout")).toBe(1);
    expect(getOperator(pair.operator.id)?.cranes).toEqual([]);
    expect(unassignCrane("kit")).toBe(0);
  });

  it("refuses to demote or delete the last admin, and profile cannot self-promote", () => {
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(updateOwnProfile(first.operator.id, { role: "user" }).ok).toBe(true);
    expect(getOperator(first.operator.id)?.role).toBe("admin");
    expect(setOperatorAccess(first.operator.id, "user", "kit")).toMatchObject({
      ok: false,
      error: "cannot demote the last admin",
    });
    const partner = addOperator("partner", pass, "admin");
    expect(partner.ok).toBe(true);
    if (!partner.ok) {
      return;
    }
    expect(setOperatorAccess(first.operator.id, "readonly", "kit").ok).toBe(true);
    expect(getOperator(first.operator.id)).toMatchObject({ role: "readonly", cranes: ["kit"] });
    expect(removeOperator(partner.operator.id, partner.operator.id)).toMatchObject({
      ok: false,
      error: "cannot delete the last admin",
    });
    expect(removeOperator(partner.operator.id, first.operator.id).ok).toBe(true);
    expect(removeOperator(partner.operator.id, partner.operator.id)).toMatchObject({
      ok: false,
      error: "cannot delete the last operator",
    });
  });
});

describe("operator profile", () => {
  const pass = "a-long-enough-pass";

  it("keeps the UUID when display name, email, chat ids, and login name change", () => {
    const first = setupOperator("bob", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const id = first.operator.id;
    const updated = updateOwnProfile(id, {
      displayName: "Robert",
      email: "bob@example.com",
      description: "owns the mini",
      channels: { telegram: ["123456"], slack: ["U012ABCDEF"], discord: ["123456789012345678"] },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.operator.id).toBe(id);
    expect(updated.operator).toMatchObject({
      name: "bob",
      displayName: "Robert",
      email: "bob@example.com",
      description: "owns the mini",
      channels: { telegram: ["123456"], slack: ["U012ABCDEF"], discord: ["123456789012345678"] },
    });

    const renamed = updateOwnProfile(id, { name: "robert" });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    expect(renamed.operator.id).toBe(id);
    expect(renamed.operator.name).toBe("robert");
    expect(loginOperator("bob", pass).ok).toBe(false);
    expect(loginOperator("robert", pass).ok).toBe(true);
    expect(operatorFromRequest(req("http://127.0.0.1/api/door", first.token))?.displayName).toBe("Robert");
  });

  it("rejects @usernames and stores a jpeg next to the db", () => {
    const first = setupOperator("bob", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(updateOwnProfile(first.operator.id, { channels: { telegram: ["@bob"], slack: [], discord: [] } })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(updateOwnProfile(first.operator.id, { email: "not-an-email" })).toMatchObject({ ok: false, status: 400 });

    const jpeg = new Uint8Array(128);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    jpeg[127] = 0xd9;
    const saved = saveOperatorAvatar(first.operator.id, jpeg);
    expect(saved.ok).toBe(true);
    const hit = readOperatorAvatar(first.operator.id);
    expect(hit?.type).toBe("image/jpeg");
    expect(getOperator(first.operator.id)?.avatarRev).toBeGreaterThan(0);
  });

  it("adds profile columns onto an existing operator table", () => {
    closeYardDb();
    const d = new DatabaseSync(dbPath());
    d.exec(`
      CREATE TABLE operator (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_salt BLOB NOT NULL,
        pass_hash BLOB NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    d.close();
    const cols = yardDb()
      .prepare("PRAGMA table_info(operator)")
      .all() as { name: string }[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining(["display_name", "email", "description", "role", "crane_slug", "channels"]),
    );
    expect(setupOperator("kit", pass).ok).toBe(true);
  });
});
