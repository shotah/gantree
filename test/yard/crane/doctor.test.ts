import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return { ...actual, execStatus: vi.fn() };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    { name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." },
    {
      name: "google",
      command: "google-mcp",
      envKeys: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      auth_args: ["auth"],
      blurb: "Gmail.",
    },
  ],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { doctor, parseGantryStatusJson } from "@/lib/yard/crane/doctor";
import { execStatus } from "@/lib/yard/host/docker";
import { stringifyMcpToml } from "@/lib/yard/host/files";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(execStatus).mockReset();
});

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function craneFiles(opts?: { persona?: boolean; oauth?: boolean; env?: string; mcp?: string }) {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  const personaDir = join(root, "persona");
  const dataDir = join(root, "data");
  mkdirSync(personaDir);
  mkdirSync(dataDir);
  if (opts?.persona !== false) {
    writeFileSync(join(personaDir, "PERSONA.md"), "# kit\n");
  }
  if (opts?.oauth) {
    writeFileSync(join(dataDir, "google-oauth.json"), "{}");
  }
  const mcpManifest = join(root, "mcp.toml");
  writeFileSync(
    mcpManifest,
    opts?.mcp ??
      stringifyMcpToml([
        { name: "math", command: "mcp-go-math" },
        { name: "google", command: "google-mcp", auth_args: ["auth"] },
      ]),
  );
  const envFile = join(root, ".env");
  writeFileSync(envFile, opts?.env ?? "GOOGLE_OAUTH_CLIENT_ID=id\nGOOGLE_OAUTH_CLIENT_SECRET=sec\n");
  return { personaDir, dataDir, mcpManifest, envFile };
}

describe("doctor", () => {
  it("returns null for an unknown slug", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await doctor("missing")).toBeNull();
  });

  it("is honest when the process is down and persona/mcp paths are unknown", async () => {
    vi.mocked(getGantry).mockResolvedValue(
      card({
        state: "exited",
        health: null,
        personaDir: null,
        mcpManifest: null,
        envFile: null,
        dataDir: null,
        containerId: null,
      }),
    );
    const report = await doctor("kit");
    expect(report?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "process")?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "persona")?.detail).toMatch(/discover mode/);
    expect(report?.checks.find((c) => c.id === "mcp-listed")?.detail).toMatch(/discover mode/);
  });

  it("flags missing PERSONA.md, empty mcp.toml, and missing env", async () => {
    const files = craneFiles({
      persona: false,
      env: "CHANNEL=telegram\n",
      mcp: stringifyMcpToml([]),
    });
    vi.mocked(getGantry).mockResolvedValue(
      card({
        state: "running",
        health: "healthy",
        mcpListed: 0,
        ...files,
      }),
    );
    const report = await doctor("kit");
    expect(report?.checks.find((c) => c.id === "persona")?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "mcp-listed")?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "docker-health")?.detail).toMatch(/no MCP listed/);
  });

  it("checks env keys, oauth session file, and gantry status", async () => {
    const files = craneFiles({ oauth: true });
    vi.mocked(getGantry).mockResolvedValue(card({ ...files }));
    vi.mocked(execStatus).mockResolvedValue("ok: channel telegram");
    const report = await doctor("kit");
    expect(report?.ok).toBe(true);
    expect(report?.checks.find((c) => c.id === "env:google")?.ok).toBe(true);
    expect(report?.checks.find((c) => c.id === "oauth:google")?.detail).toMatch(/session file present/);
    expect(report?.checks.find((c) => c.id === "gantry-status")?.ok).toBe(true);
  });

  it("nags needs-auth and a skipped gantry status, and missing exec", async () => {
    const files = craneFiles({ oauth: false });
    vi.mocked(getGantry).mockResolvedValue(card({ ...files }));
    vi.mocked(execStatus).mockResolvedValue("mcp google skipped");
    const report = await doctor("kit");
    expect(report?.checks.find((c) => c.id === "oauth:google")?.detail).toMatch(/needs auth/);
    expect(report?.checks.find((c) => c.id === "gantry-status")?.ok).toBe(false);

    vi.mocked(execStatus).mockResolvedValue(null);
    const noExec = await doctor("kit");
    expect(noExec?.checks.find((c) => c.id === "gantry-status")?.detail).toMatch(/could not exec/);
  });

  it("parses gantry status JSON so ok:false is not fake-green", async () => {
    const files = craneFiles({ oauth: true });
    vi.mocked(getGantry).mockResolvedValue(card({ ...files }));
    vi.mocked(execStatus).mockResolvedValue(
      JSON.stringify({
        alive: true,
        ok: false,
        reason: "mcp_all_skipped",
        channel: "telegram",
        mcp: {
          listed: 2,
          connected: 0,
          skipped: 2,
          servers: [
            { name: "google", state: "skipped", reason: "no_oauth", note: "no token", auth: true },
            { name: "math", state: "skipped", reason: "no_binary", auth: false },
          ],
        },
      }),
    );
    const report = await doctor("kit");
    expect(report?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "gantry-status")?.ok).toBe(false);
    expect(report?.checks.find((c) => c.id === "gantry-status")?.detail).toMatch(/mcp_all_skipped/);
    expect(report?.checks.find((c) => c.id === "skip:google")?.detail).toMatch(/no_oauth/);
    expect(report?.checks.find((c) => c.id === "skip:math")?.detail).toMatch(/no_binary/);
  });

  it("parseGantryStatusJson finds the object among stderr noise", () => {
    const parsed = parseGantryStatusJson('status: no_heartbeat\n{"alive":false,"ok":false,"reason":"no_heartbeat","channel":"telegram","persona":{},"mcp":{}}\n');
    expect(parsed?.alive).toBe(false);
    expect(parsed?.reason).toBe("no_heartbeat");
    expect(parseGantryStatusJson("ok: channel telegram")).toBeNull();
  });
});
