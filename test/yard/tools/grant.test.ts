import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    { name: "math", command: "mcp-go-math", args: ["--quiet"], envKeys: [], blurb: "Math." },
    { name: "google", command: "google-mcp", auth_args: ["auth"], envKeys: [], blurb: "Gmail." },
  ],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { stringifyMcpToml } from "@/lib/yard/host/files";
import { grant, revoke } from "@/lib/yard/tools/grant";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
});

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function mcpFile(body?: string): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  const mcp = join(root, "mcp.toml");
  writeFileSync(mcp, body ?? stringifyMcpToml([{ name: "math", command: "mcp-go-math" }]));
  return mcp;
}

describe("grant", () => {
  it("refuses when inventory has no mcp path", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: null }));
    const out = await grant("kit", "math");
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/mcp_manifest/);
    expect(out.servers).toEqual([]);
  });

  it("is a no-op when the server is already listed", async () => {
    const mcp = mcpFile();
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp }));
    const out = await grant("kit", "math");
    expect(out).toMatchObject({ ok: true, detail: "math already granted" });
    expect(out.servers.map((s) => s.name)).toEqual(["math"]);
  });

  it("appends a catalog server and an unknown command", async () => {
    const mcp = mcpFile(stringifyMcpToml([]));
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp }));
    const google = await grant("kit", "google");
    expect(google.ok).toBe(true);
    expect(google.servers).toEqual([
      expect.objectContaining({ name: "google", command: "google-mcp", auth_args: ["auth"] }),
    ]);
    const custom = await grant("kit", "mycustom");
    expect(custom.servers.map((s) => s.name)).toEqual(["google", "mycustom"]);
    expect(custom.servers[1]).toEqual({ name: "mycustom", command: "mycustom" });
    expect(readFileSync(mcp, "utf8")).toContain("mycustom");
  });
});

describe("revoke", () => {
  it("refuses when inventory has no mcp path", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    const out = await revoke("kit", "math");
    expect(out).toMatchObject({ ok: false, servers: [] });
  });

  it("omits the server from mcp.toml", async () => {
    const mcp = mcpFile(
      stringifyMcpToml([
        { name: "math", command: "mcp-go-math" },
        { name: "google", command: "google-mcp" },
      ]),
    );
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp }));
    const out = await revoke("kit", "google");
    expect(out.ok).toBe(true);
    expect(out.servers.map((s) => s.name)).toEqual(["math"]);
    expect(readFileSync(mcp, "utf8")).not.toContain("google");
  });
});
