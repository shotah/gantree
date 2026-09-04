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
    {
      name: "google",
      command: "google-mcp",
      auth_args: ["auth"],
      envKeys: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      blurb: "Gmail.",
    },
    { name: "maps", command: "google-maps-mcp", envKeys: ["GOOGLE_MAPS_API_KEY"], blurb: "Places." },
    { name: "boards", command: "boards-mcp", envKeys: ["BOARDS_AUTHOR"], blurb: "Corkboard." },
  ],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { loadEnvFile } from "@/lib/yard/host/envfile";
import { stringifyMcpToml } from "@/lib/yard/host/files";
import { grant, revoke, enrichDownloadUrls } from "@/lib/yard/tools/grant";

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
    expect(google.detail).toContain("granted google");
    expect(google.servers).toEqual([
      expect.objectContaining({ name: "google", command: "google-mcp", auth_args: ["auth"] }),
    ]);
    const custom = await grant("kit", "mycustom");
    expect(custom.servers.map((s) => s.name)).toEqual(["google", "mycustom"]);
    expect(custom.servers[1]).toEqual({ name: "mycustom", command: "mycustom" });
    expect(readFileSync(mcp, "utf8")).toContain("mycustom");
  });

  it("copies env_keys onto mcp.toml and names them in the detail", async () => {
    const mcp = mcpFile(stringifyMcpToml([]));
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp }));
    const maps = await grant("kit", "maps");
    expect(maps.ok).toBe(true);
    expect(maps.detail).toContain("GOOGLE_MAPS_API_KEY");
    expect(maps.servers[0]).toEqual(expect.objectContaining({ name: "maps", env_keys: ["GOOGLE_MAPS_API_KEY"] }));
    expect(readFileSync(mcp, "utf8")).toContain("GOOGLE_MAPS_API_KEY");
  });

  it("writes only that crane's mcp.toml", async () => {
    const kit = mcpFile(stringifyMcpToml([]));
    const jules = mcpFile(stringifyMcpToml([]));
    vi.mocked(getGantry).mockImplementation(async (slug: string) => {
      if (slug === "kit") {
        return card({ slug: "kit", mcpManifest: kit });
      }
      if (slug === "jules") {
        return card({ slug: "jules", mcpManifest: jules });
      }
      return null;
    });
    const out = await grant("kit", "google");
    expect(out.ok).toBe(true);
    expect(readFileSync(kit, "utf8")).toContain("google");
    expect(readFileSync(jules, "utf8")).not.toContain("google");
  });

  it("seeds BOARDS_AUTHOR from the slug when granting boards", async () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const mcp = join(root, "mcp.toml");
    const envFile = join(root, ".env");
    writeFileSync(mcp, stringifyMcpToml([]));
    writeFileSync(envFile, "CHANNEL=telegram\n");
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp, envFile }));
    const out = await grant("kit", "boards");
    expect(out.ok).toBe(true);
    expect(out.servers[0]).toEqual(expect.objectContaining({ name: "boards", command: "boards-mcp" }));
    expect(loadEnvFile(envFile).BOARDS_AUTHOR).toBe("kit");
    expect(loadEnvFile(envFile).CHANNEL).toBe("telegram");
  });

  it("does not overwrite an existing BOARDS_AUTHOR on grant", async () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const mcp = join(root, "mcp.toml");
    const envFile = join(root, ".env");
    writeFileSync(mcp, stringifyMcpToml([]));
    writeFileSync(envFile, "BOARDS_AUTHOR=jules\n");
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp, envFile }));
    await grant("kit", "boards");
    expect(loadEnvFile(envFile).BOARDS_AUTHOR).toBe("jules");
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

describe("enrichDownloadUrls", () => {
  it("fills catalog download_* when the manifest only has name/command", () => {
    const catalog = [
      {
        name: "google",
        command: "google-mcp",
        download_url: "https://example.com/google.tgz",
        download_tag: "latest",
        envKeys: [],
        blurb: "",
      },
    ];
    const out = enrichDownloadUrls(
      [
        { name: "google", command: "google-mcp" },
        { name: "custom", command: "my-bin", download_url: "https://mine.example/x.tgz" },
      ],
      catalog,
    );
    expect(out[0]).toMatchObject({
      name: "google",
      download_url: "https://example.com/google.tgz",
      download_tag: "latest",
    });
    expect(out[1]?.download_url).toBe("https://mine.example/x.tgz");
  });

  it("rewrites a zchee google-search download_url to the yard catalog", () => {
    const catalog = [
      {
        name: "google-search",
        command: "mcp-gemini-google-search",
        download_url: "https://github.com/shotah/mcp-gemini-search/releases/download/{tag}/mcp-gemini-google-search_{version}_{os}_{arch}.tar.gz",
        download_tag: "latest",
        envKeys: [],
        blurb: "",
      },
    ];
    const out = enrichDownloadUrls(
      [
        {
          name: "google-search",
          command: "mcp-gemini-google-search",
          download_url: "https://github.com/zchee/mcp-gemini-search/releases/download/latest/x.tgz",
        },
      ],
      catalog,
    );
    expect(out[0]?.download_url).toContain("github.com/shotah/mcp-gemini-search");
    expect(out[0]?.download_url).not.toMatch(/zchee/);
  });
});
