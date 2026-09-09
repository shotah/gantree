import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    listGantryContainers: vi.fn(),
    inspectByName: vi.fn(),
  };
});

import { GET, POST, PUT } from "@/app/api/gantries/[slug]/pendant/route";
import { writeCraneFiles } from "@/lib/yard/crane/build";
import { resetYardDockerCache } from "@/lib/yard/crane/inventory";
import { addOperator, listYardEvents, loginOperator, SESSION_COOKIE, setupOperator } from "@/lib/yard/door";
import { closeYardDb } from "@/lib/yard/door/store";
import { listGantryContainers } from "@/lib/yard/host/docker";
import { loadEnvFile } from "@/lib/yard/host/envfile";

const dirs: string[] = [];
const pass = "a-long-enough-pass";

beforeEach(() => {
  resetYardDockerCache();
  vi.mocked(listGantryContainers).mockReset();
  vi.mocked(listGantryContainers).mockResolvedValue([]);
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  process.env.GANTREE_DB = join(root, "gantree.db");
  closeYardDb();
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_TOML;
  delete process.env.GANTREE_DB;
});

function cookie(token: string): string {
  return `${SESSION_COOKIE}=${token}`;
}

describe("pendant route", () => {
  it("lets user GET and PUT, records an audit row, and forbids readonly PUT", async () => {
    const kit = writeCraneFiles({
      slug: "kit",
      channel: "pendant",
      env: { CHANNEL: "pendant", PENDANT_BEARER: "b", PENDANT_ALLOWED_USERS: "" },
    });
    setupOperator("kit", pass);
    addOperator("ada", pass, "user", "kit");
    addOperator("look", pass, "readonly", "kit");
    const ada = loginOperator("ada", pass);
    const look = loginOperator("look", pass);
    expect(ada.ok && look.ok).toBe(true);
    if (!ada.ok || !look.ok) {
      return;
    }

    const got = await GET(new Request("http://127.0.0.1/api/gantries/kit/pendant", { headers: { cookie: cookie(ada.token) } }), {
      params: Promise.resolve({ slug: "kit" }),
    });
    expect(got.status).toBe(200);
    expect(await got.json()).toMatchObject({ enabled: true, bearerSet: true });

    const put = await PUT(
      new Request("http://127.0.0.1/api/gantries/kit/pendant", {
        method: "PUT",
        headers: { cookie: cookie(ada.token), "content-type": "application/json" },
        body: JSON.stringify({ entries: ["ada@example.com"] }),
      }),
      { params: Promise.resolve({ slug: "kit" }) },
    );
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ ok: true, allowlist: ["ada@example.com"] });
    expect(loadEnvFile(kit.envFile).PENDANT_ALLOWED_USERS).toBe("ada@example.com");
    expect(listYardEvents({ kind: "pendant.allowlist", slug: "kit" })[0]).toMatchObject({
      kind: "pendant.allowlist",
      slug: "kit",
      detail: "1",
    });

    const forbidden = await PUT(
      new Request("http://127.0.0.1/api/gantries/kit/pendant", {
        method: "PUT",
        headers: { cookie: cookie(look.token), "content-type": "application/json" },
        body: JSON.stringify({ entries: ["bob@example.com"] }),
      }),
      { params: Promise.resolve({ slug: "kit" }) },
    );
    expect(forbidden.status).toBe(403);
    expect(loadEnvFile(kit.envFile).PENDANT_ALLOWED_USERS).toBe("ada@example.com");
  });

  it("refuses rotate without confirm or Cloudflare settings", async () => {
    writeCraneFiles({
      slug: "kit",
      channel: "pendant",
      env: { CHANNEL: "pendant", PENDANT_BEARER: "b", PENDANT_ALLOWED_USERS: "ada@example.com" },
    });
    setupOperator("kit", pass);
    const kit = loginOperator("kit", pass);
    expect(kit.ok).toBe(true);
    if (!kit.ok) {
      return;
    }
    const noConfirm = await POST(
      new Request("http://127.0.0.1/api/gantries/kit/pendant", {
        method: "POST",
        headers: { cookie: cookie(kit.token), "content-type": "application/json" },
        body: JSON.stringify({ op: "rotate" }),
      }),
      { params: Promise.resolve({ slug: "kit" }) },
    );
    expect(noConfirm.status).toBe(400);
    const rotated = await POST(
      new Request("http://127.0.0.1/api/gantries/kit/pendant", {
        method: "POST",
        headers: { cookie: cookie(kit.token), "content-type": "application/json" },
        body: JSON.stringify({ op: "rotate", confirm: true }),
      }),
      { params: Promise.resolve({ slug: "kit" }) },
    );
    expect(rotated.status).toBe(400);
    expect(await rotated.json()).toMatchObject({ detail: expect.stringMatching(/Settings → Pendant/) });
  });
});
