import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

import { GET, PUT } from "@/app/api/gantries/[slug]/files/route";
import { getGantry } from "@/lib/yard/crane/inventory";
import { closeYardDb } from "@/lib/yard/door/store";
import { SESSION_COOKIE, setupOperator } from "@/lib/yard/door/gate";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  closeYardDb();
  const root = mkdtempSync(join(tmpdir(), "gantree-env-confirm-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_DB = join(root, "gantree.db");
  delete process.env.HOST;
  delete process.env.GANTREE_DEV;
});

afterEach(() => {
  closeYardDb();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_DB;
});

async function authed(token: string, init?: RequestInit): Promise<Request> {
  return new Request("http://127.0.0.1/api/gantries/kit/files", {
    ...init,
    headers: { cookie: `${SESSION_COOKIE}=${token}`, "content-type": "application/json", ...init?.headers },
  });
}

const ctx = { params: Promise.resolve({ slug: "kit" }) };

describe("files env write", () => {
  it("masks secrets on GET and refuses a token write without confirmToken", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const envFile = join(dirs[0]!, ".env");
    writeFileSync(envFile, "TELEGRAM_BOT_TOKEN=old-secret\nCHANNEL=telegram\n");
    vi.mocked(getGantry).mockResolvedValue(card({ envFile, personaDir: null, mcpManifest: null }));

    const got = await GET(await authed(created.token), ctx);
    expect(got.status).toBe(200);
    const body = (await got.json()) as { env: Record<string, { set: boolean; secret: boolean; value: string }> };
    expect(body.env.TELEGRAM_BOT_TOKEN).toEqual({ set: true, secret: true, value: "" });
    expect(body.env.CHANNEL?.value).toBe("telegram");

    const denied = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ env: { TELEGRAM_BOT_TOKEN: "new-secret" } }),
      }),
      ctx,
    );
    expect(denied.status).toBe(400);
    expect(await denied.json()).toEqual({ error: "confirmToken required to write secrets" });
    expect(readFileSync(envFile, "utf8")).toContain("old-secret");

    const blank = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ env: { TELEGRAM_BOT_TOKEN: "" } }),
      }),
      ctx,
    );
    expect(blank.status).toBe(200);
    expect(readFileSync(envFile, "utf8")).toContain("old-secret");

    const channel = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ env: { CHANNEL: "stdio" } }),
      }),
      ctx,
    );
    expect(channel.status).toBe(200);
    expect(readFileSync(envFile, "utf8")).toContain("CHANNEL=stdio");

    const ok = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ env: { TELEGRAM_BOT_TOKEN: "new-secret" }, confirmToken: true }),
      }),
      ctx,
    );
    expect(ok.status).toBe(200);
    expect(readFileSync(envFile, "utf8")).toContain("new-secret");
    expect(readFileSync(envFile, "utf8")).not.toContain("old-secret");
  });

  it("401s without a session", async () => {
    const res = await GET(new Request("http://127.0.0.1/api/gantries/kit/files"), ctx);
    expect(res.status).toBe(401);
  });
});
