import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    listGantryContainers: vi.fn(),
    inspectByName: vi.fn(),
    docker: vi.fn(),
    containerLogsBuffer: vi.fn(),
  };
});

import { writeCraneFiles } from "@/lib/yard/crane/build";
import { destroyCrane, dropCraneFiles } from "@/lib/yard/crane/destroy";
import { resetYardDockerCache } from "@/lib/yard/crane/inventory";
import { addOperator, getOperator, loginOperator, SESSION_COOKIE, setupOperator } from "@/lib/yard/door";
import { closeYardDb } from "@/lib/yard/door/store";
import { docker, inspectByName, listGantryContainers } from "@/lib/yard/host/docker";
import { loadGantreeToml } from "@/lib/yard/host/files";
import { persistTurn, recallSamples } from "@/lib/yard/observe/memory";
import { DELETE as deleteGantry } from "@/app/api/gantries/[slug]/route";

const dirs: string[] = [];

beforeEach(() => {
  resetYardDockerCache();
  vi.mocked(listGantryContainers).mockReset();
  vi.mocked(inspectByName).mockReset();
  vi.mocked(docker).mockReset();
  vi.mocked(listGantryContainers).mockResolvedValue([]);
  vi.mocked(inspectByName).mockResolvedValue(null);
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

function mockContainer() {
  const stop = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  vi.mocked(inspectByName).mockResolvedValue({
    listed: { Id: "cid" },
    info: { Id: "cid" },
  } as never);
  vi.mocked(docker).mockReturnValue({ getContainer: () => ({ stop, remove }) } as never);
  return { stop, remove };
}

describe("destroyCrane", () => {
  it("rejects an unknown slug", async () => {
    expect(await destroyCrane("nope")).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/unknown/),
      removed: { container: false, inventory: false, files: false },
    });
  });

  it("removes the container and inventory but keeps files by default", async () => {
    const kit = writeCraneFiles({ slug: "kit" });
    writeCraneFiles({ slug: "jules" });
    const { stop, remove } = mockContainer();
    persistTurn("kit", {
      at: Date.now(),
      key: "turn-kit",
      rounds: 1,
      recoveries: 0,
      estTokens: 4,
      promptEstTokens: 3,
      genEstTokens: 1,
      source: null,
      userId: null,
      sessionId: null,
      outcome: "ok",
    });
    setupOperator("admin", "a-long-enough-pass");
    const user = addOperator("ada", "a-long-enough-pass", "user", ["kit", "jules"]);
    expect(user.ok).toBe(true);

    const out = await destroyCrane("kit");
    expect(out.ok).toBe(true);
    expect(out.removed).toEqual({ container: true, inventory: true, files: false });
    expect(out.detail).toMatch(/files kept/);
    expect(stop).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ force: true });
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["jules"]);
    expect(existsSync(kit.dir)).toBe(true);
    expect(existsSync(kit.personaDir)).toBe(true);
    if (user.ok) {
      expect(getOperator(user.operator.id)?.cranes).toEqual(["jules"]);
    }
    expect(recallSamples("kit", { host: 10, turns: 10, mcp: 10, uptime: 10 }).turns).toEqual([]);
  });

  it("deletes files when asked and leaves the other crane", async () => {
    const kit = writeCraneFiles({ slug: "kit" });
    const jules = writeCraneFiles({ slug: "jules" });
    mockContainer();
    const out = await destroyCrane("kit", { removeFiles: true });
    expect(out.ok).toBe(true);
    expect(out.removed.files).toBe(true);
    expect(existsSync(kit.dir)).toBe(false);
    expect(existsSync(jules.dir)).toBe(true);
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["jules"]);
  });

  it("still drops inventory when there is no container", async () => {
    const kit = writeCraneFiles({ slug: "kit" });
    const out = await destroyCrane("kit");
    expect(out.ok).toBe(true);
    expect(out.removed).toEqual({ container: false, inventory: true, files: false });
    expect(out.detail).toMatch(/no container/);
    expect(loadGantreeToml()?.gantry).toEqual([]);
    expect(existsSync(kit.dir)).toBe(true);
  });

  it("does not drop inventory when docker remove fails", async () => {
    writeCraneFiles({ slug: "kit" });
    const stop = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockRejectedValue(new Error("busy"));
    vi.mocked(inspectByName).mockResolvedValue({
      listed: { Id: "cid" },
      info: { Id: "cid" },
    } as never);
    vi.mocked(docker).mockReturnValue({ getContainer: () => ({ stop, remove }) } as never);
    const out = await destroyCrane("kit");
    expect(out.ok).toBe(false);
    expect(out.detail).toBe("busy");
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["kit"]);
  });
});

describe("dropCraneFiles", () => {
  it("returns false when the folder is missing or the slug is unsafe", () => {
    expect(dropCraneFiles("kit")).toBe(false);
    expect(dropCraneFiles("../etc")).toBe(false);
    expect(dropCraneFiles("kit/../jules")).toBe(false);
  });
});

describe("DELETE /api/gantries/[slug]", () => {
  const pass = "a-long-enough-pass";

  async function destroyAs(token: string, slug: string, body: { removeFiles?: boolean } = {}) {
    return deleteGantry(
      new Request(`http://127.0.0.1/api/gantries/${slug}`, {
        method: "DELETE",
        headers: { cookie: `${SESSION_COOKIE}=${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug }) },
    );
  }

  it("lets a user destroy an assigned crane and an admin destroy any", async () => {
    writeCraneFiles({ slug: "kit" });
    writeCraneFiles({ slug: "jules" });
    const first = setupOperator("kit", pass);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const user = addOperator("ada", pass, "user", "kit");
    expect(user.ok).toBe(true);
    if (!user.ok) {
      return;
    }
    const ada = loginOperator("ada", pass);
    expect(ada.ok).toBe(true);
    if (!ada.ok) {
      return;
    }
    const own = await destroyAs(ada.token, "kit");
    expect(own.status).toBe(200);
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["jules"]);

    const other = await destroyAs(ada.token, "jules");
    expect(other.status).toBe(404);

    const admin = await destroyAs(first.token, "jules");
    expect(admin.status).toBe(200);
    expect(loadGantreeToml()?.gantry).toEqual([]);
  });

  it("lets readonly look but not destroy", async () => {
    writeCraneFiles({ slug: "kit" });
    setupOperator("kit", pass);
    addOperator("look", pass, "readonly", "kit");
    const look = loginOperator("look", pass);
    expect(look.ok).toBe(true);
    if (!look.ok) {
      return;
    }
    const res = await destroyAs(look.token, "kit");
    expect(res.status).toBe(403);
    expect(loadGantreeToml()?.gantry?.map((g) => g.slug)).toEqual(["kit"]);
  });
});
