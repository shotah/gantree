import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/pendant/route";
import { addOperator, loginOperator, SESSION_COOKIE, setupOperator } from "@/lib/yard/door";
import { closeYardDb } from "@/lib/yard/door/store";
import { loadPendantSettings } from "@/lib/yard/pendant/settings";

const dirs: string[] = [];
const pass = "a-long-enough-pass";
const TOKEN = "cf-token-abcdefghijklmnopqrstuvwxyz";
const ACCOUNT = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_DB = join(root, "gantree.db");
  closeYardDb();
});

afterEach(() => {
  closeYardDb();
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_DB;
});

function cookie(token: string): string {
  return `${SESSION_COOKIE}=${token}`;
}

describe("GET/PUT /api/pendant", () => {
  it("is admin-only and requires confirm", async () => {
    setupOperator("kit", pass);
    addOperator("ada", pass, "user", "kit");
    const kit = loginOperator("kit", pass);
    const ada = loginOperator("ada", pass);
    expect(kit.ok && ada.ok).toBe(true);
    if (!kit.ok || !ada.ok) {
      return;
    }
    const forbidden = await GET(new Request("http://127.0.0.1/api/pendant", { headers: { cookie: cookie(ada.token) } }));
    expect(forbidden.status).toBe(403);

    const got = await GET(new Request("http://127.0.0.1/api/pendant", { headers: { cookie: cookie(kit.token) } }));
    expect(got.status).toBe(200);
    expect(await got.json()).toMatchObject({ pendant: { ready: false, workerName: "gantry-pendant" } });

    const noConfirm = await PUT(
      new Request("http://127.0.0.1/api/pendant", {
        method: "PUT",
        headers: { cookie: cookie(kit.token), "content-type": "application/json" },
        body: JSON.stringify({ accountId: ACCOUNT }),
      }),
    );
    expect(noConfirm.status).toBe(400);
  });

  it("saves Cloudflare settings without calling fetch when Google is empty", async () => {
    setupOperator("kit", pass);
    const kit = loginOperator("kit", pass);
    expect(kit.ok).toBe(true);
    if (!kit.ok) {
      return;
    }
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const saved = await PUT(
      new Request("http://127.0.0.1/api/pendant", {
        method: "PUT",
        headers: { cookie: cookie(kit.token), "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          apiToken: TOKEN,
          accountId: ACCOUNT,
          origin: "https://gantry-pendant.example.workers.dev",
        }),
      }),
    );
    expect(saved.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loadPendantSettings().apiToken).toBe(TOKEN);
    const body = await saved.json() as { pendant: { ready: boolean; apiTokenSet: boolean } };
    expect(body.pendant.ready).toBe(true);
    expect(body.pendant.apiTokenSet).toBe(true);
  });
});
