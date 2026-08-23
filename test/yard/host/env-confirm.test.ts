import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    expect(await denied.json()).toEqual({ error: "confirmToken required to write secrets", saved: [] });
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

  it("writes LLM_BASE_URL even when a token is refused without confirmToken", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const envFile = join(dirs[0]!, ".env");
    writeFileSync(envFile, "LLM_BASE_URL=nura-assaf\nTELEGRAM_BOT_TOKEN=old-secret\nCHANNEL=telegram\n");
    vi.mocked(getGantry).mockResolvedValue(card({ envFile, personaDir: null, mcpManifest: null }));

    const denied = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({
          env: { LLM_BASE_URL: "https://example.test/v1", TELEGRAM_BOT_TOKEN: "new-secret" },
        }),
      }),
      ctx,
    );
    expect(denied.status).toBe(400);
    expect(await denied.json()).toEqual({
      error: "confirmToken required to write secrets",
      saved: ["LLM_BASE_URL"],
    });
    const text = readFileSync(envFile, "utf8");
    expect(text).toContain("LLM_BASE_URL=https://example.test/v1");
    expect(text).toContain("old-secret");
    expect(text).not.toContain("new-secret");
  });

  it("401s without a session", async () => {
    const res = await GET(new Request("http://127.0.0.1/api/gantries/kit/files"), ctx);
    expect(res.status).toBe(401);
  });
});

describe("files PERSONA.md and SELF.md", () => {
  it("reads both and writes each without clobbering the other", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const personaDir = join(dirs[0]!, "persona");
    mkdirSync(personaDir);
    writeFileSync(join(personaDir, "PERSONA.md"), "# you\n");
    writeFileSync(join(personaDir, "SELF.md"), "# me\n");
    vi.mocked(getGantry).mockResolvedValue(card({ personaDir, envFile: null, mcpManifest: null }));

    const got = await GET(await authed(created.token), ctx);
    expect(got.status).toBe(200);
    const body = (await got.json()) as { persona: string | null; self: string | null; writable: boolean };
    expect(body.persona).toBe("# you\n");
    expect(body.self).toBe("# me\n");
    expect(body.writable).toBe(true);

    const personaPut = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ persona: "# who you are\n" }),
      }),
      ctx,
    );
    expect(personaPut.status).toBe(200);
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# who you are\n");
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("# me\n");

    const selfPut = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ self: "# who I am\n" }),
      }),
      ctx,
    );
    expect(selfPut.status).toBe(200);
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("# who I am\n");
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# who you are\n");
  });

  it("creates SELF.md on save when the crane only had PERSONA.md", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const personaDir = join(dirs[0]!, "persona");
    mkdirSync(personaDir);
    writeFileSync(join(personaDir, "PERSONA.md"), "# noodles\n");
    vi.mocked(getGantry).mockResolvedValue(card({ personaDir, envFile: null, mcpManifest: null }));

    const missing = await GET(await authed(created.token), ctx);
    expect(((await missing.json()) as { persona: string | null; self: string | null }).self).toBeNull();
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# noodles\n");

    const createdSelf = await PUT(
      await authed(created.token, {
        method: "PUT",
        body: JSON.stringify({ self: "# distilled\n" }),
      }),
      ctx,
    );
    expect(createdSelf.status).toBe(200);
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("# distilled\n");
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# noodles\n");
  });

  it("does not rewrite PERSONA.md or SELF.md on GET", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const personaDir = join(dirs[0]!, "persona");
    mkdirSync(personaDir);
    writeFileSync(join(personaDir, "PERSONA.md"), "# kit\n\nA long-horizon personal agent.\n");
    writeFileSync(join(personaDir, "SELF.md"), "- ritual: tea at 4\n");
    vi.mocked(getGantry).mockResolvedValue(card({ personaDir, envFile: null, mcpManifest: null }));

    const got = await GET(await authed(created.token), ctx);
    expect(got.status).toBe(200);
    const body = (await got.json()) as { persona: string | null; self: string | null };
    expect(body.persona).toBe("# kit\n\nA long-horizon personal agent.\n");
    expect(body.self).toBe("- ritual: tea at 4\n");
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# kit\n\nA long-horizon personal agent.\n");
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("- ritual: tea at 4\n");
  });

  it("returns templates without writing PERSONA.md or SELF.md", async () => {
    const created = setupOperator("kit", "a-long-enough-pass");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const personaDir = join(dirs[0]!, "persona");
    mkdirSync(personaDir);
    writeFileSync(join(personaDir, "PERSONA.md"), "# kit\n\nkeep me\n");
    writeFileSync(join(personaDir, "SELF.md"), "- ritual: tea at 4\n");
    vi.mocked(getGantry).mockResolvedValue(card({ personaDir, envFile: null, mcpManifest: null }));

    const got = await GET(
      new Request("http://127.0.0.1/api/gantries/kit/files?templates=1", {
        headers: { cookie: `${SESSION_COOKIE}=${created.token}` },
      }),
      ctx,
    );
    expect(got.status).toBe(200);
    const body = (await got.json()) as { personaTemplate?: string; selfTemplate?: string };
    expect(body.personaTemplate).toContain("## Identity");
    expect(body.personaTemplate).toContain("**Name:** Kit");
    expect(body.selfTemplate).toContain("Who You Are Becoming");
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# kit\n\nkeep me\n");
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("- ritual: tea at 4\n");
  });
});
