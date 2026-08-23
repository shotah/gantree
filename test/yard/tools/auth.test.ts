import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return { ...actual, execGantry: vi.fn() };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    {
      name: "google",
      command: "google-mcp",
      download_url: "https://example.com/google.tgz",
      download_tag: "latest",
      envKeys: [],
      blurb: "",
    },
    {
      name: "google-search",
      command: "mcp-gemini-google-search",
      download_url:
        "https://github.com/shotah/mcp-gemini-search/releases/download/{tag}/mcp-gemini-google-search_{version}_{os}_{arch}.tar.gz",
      download_tag: "latest",
      envKeys: [],
      blurb: "",
    },
  ],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { execGantry } from "@/lib/yard/host/docker";
import { authCmd, exchangeAuth, extractAuthUrl, fetchNeedsReload, kickAuth, toolsFetch, waitAuth } from "@/lib/yard/tools/auth";

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(execGantry).mockReset();
});

describe("authCmd", () => {
  it("starts PKCE with url and exchanges with the code", () => {
    expect(authCmd("google", "start", undefined, "pkce")).toEqual(["auth", "google", "url"]);
    expect(authCmd("google", "exchange", "abc", "pkce")).toEqual(["auth", "google", "exchange", "abc"]);
  });

  it("uses device wait for youtube", () => {
    expect(authCmd("youtube", "start", undefined, "device")).toEqual(["auth", "youtube"]);
    expect(authCmd("youtube", "wait")).toEqual(["auth", "youtube", "wait"]);
  });
});

describe("extractAuthUrl", () => {
  it("picks the first http(s) URL", () => {
    expect(extractAuthUrl("open https://accounts.google.com/o/oauth2?x=1 then paste")).toBe(
      "https://accounts.google.com/o/oauth2?x=1",
    );
  });

  it("returns null when there is no URL", () => {
    expect(extractAuthUrl("no link here")).toBeNull();
  });
});

describe("kickAuth / exchangeAuth / waitAuth / toolsFetch", () => {
  it("fails without a running container", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ containerId: null }));
    expect(await kickAuth("kit", "google")).toMatchObject({ ok: false, detail: "no running container" });
    vi.mocked(getGantry).mockResolvedValue(card({ state: "exited" }));
    expect(await kickAuth("kit", "google")).toMatchObject({ ok: false, detail: "container is exited" });
    expect(await toolsFetch("kit")).toMatchObject({ ok: false });
  });

  it("returns the auth URL and falls back when exec is missing", async () => {
    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(execGantry).mockResolvedValue({
      text: "open https://example.com/auth.",
      exitCode: 0,
    });
    const started = await kickAuth("kit", "google", "pkce");
    expect(started.ok).toBe(true);
    expect(started.url).toBe("https://example.com/auth");

    vi.mocked(execGantry).mockReset();
    vi.mocked(execGantry).mockResolvedValueOnce(null).mockResolvedValueOnce({ text: "ok", exitCode: 0 });
    const fallback = await kickAuth("kit", "google");
    expect(fallback.ok).toBe(true);
    expect(vi.mocked(execGantry).mock.calls.map((c) => c[1])).toEqual([
      ["auth", "google", "url"],
      ["auth", "google"],
    ]);
  });

  it("does not fall back for device flow, and waitAuth execs wait", async () => {
    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(execGantry).mockResolvedValue({ text: "", exitCode: 1 });
    const device = await kickAuth("kit", "youtube", "device");
    expect(device.ok).toBe(false);
    expect(vi.mocked(execGantry)).toHaveBeenCalledTimes(1);

    vi.mocked(execGantry).mockResolvedValue({ text: "", exitCode: 0 });
    const waited = await waitAuth("kit", "youtube");
    expect(waited.ok).toBe(true);
    expect(vi.mocked(execGantry).mock.calls.at(-1)?.[1]).toEqual(["auth", "youtube", "wait"]);
  });

  it("exchanges a code and refuses a blank paste", async () => {
    expect(await exchangeAuth("kit", "google", "  ")).toMatchObject({ ok: false, detail: expect.stringMatching(/paste/) });
    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(execGantry).mockResolvedValueOnce({ text: "nope", exitCode: 1 }).mockResolvedValueOnce({ text: "ok", exitCode: 0 });
    const out = await exchangeAuth("kit", "google", "abc", "pkce");
    expect(out.ok).toBe(true);
    expect(vi.mocked(execGantry).mock.calls.map((c) => c[1])).toEqual([
      ["auth", "google", "exchange", "abc"],
      ["auth", "google", "abc"],
    ]);
  });

  it("runs tools-fetch and reports exec failure", async () => {
    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(execGantry).mockResolvedValue({ text: "", exitCode: 0 });
    expect(await toolsFetch("kit")).toEqual({ ok: true, detail: "tools-fetch finished" });
    expect(vi.mocked(execGantry).mock.calls.at(-1)?.[1]).toEqual([
      "tools-fetch",
      "--outdir",
      "/data/bin",
      "--prune",
      "--manifest",
      "/etc/gantry/mcp.toml",
    ]);
    vi.mocked(execGantry).mockResolvedValue(null);
    expect(await toolsFetch("kit")).toMatchObject({ ok: false, detail: expect.stringMatching(/could not exec/) });
  });

  it("writes a fetch manifest when mcp.toml has no download_url", async () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    const dataDir = join(root, "data");
    mkdirSync(dataDir);
    const mcp = join(root, "mcp.toml");
    writeFileSync(mcp, '[[server]]\nname = "google"\ncommand = "google-mcp"\n');
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp, dataDir }));
    vi.mocked(execGantry).mockResolvedValue({
      text: "tools-fetch: done installed=1 skipped=0 total=1",
      exitCode: 0,
    });
    const out = await toolsFetch("kit");
    expect(out.ok).toBe(true);
    expect(vi.mocked(execGantry).mock.calls.at(-1)?.[1]).toEqual([
      "tools-fetch",
      "--outdir",
      "/data/bin",
      "--prune",
      "--manifest",
      "/data/.gantree-fetch.toml",
    ]);
    expect(readFileSync(join(dataDir, ".gantree-fetch.toml"), "utf8")).toContain("download_url");
    rmSync(root, { recursive: true, force: true });
  });

  it("rewrites a zchee google-search URL before tools-fetch", async () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    const dataDir = join(root, "data");
    mkdirSync(dataDir);
    const mcp = join(root, "mcp.toml");
    writeFileSync(
      mcp,
      '[[server]]\nname = "google-search"\ncommand = "mcp-gemini-google-search"\ndownload_url = "https://github.com/zchee/mcp-gemini-search/releases/download/latest/x.tgz"\n',
    );
    vi.mocked(getGantry).mockResolvedValue(card({ mcpManifest: mcp, dataDir }));
    vi.mocked(execGantry).mockResolvedValue({
      text: "tools-fetch: done installed=1 skipped=0 total=1",
      exitCode: 0,
    });
    const out = await toolsFetch("kit");
    expect(out.ok).toBe(true);
    expect(vi.mocked(execGantry).mock.calls.at(-1)?.[1]).toEqual([
      "tools-fetch",
      "--outdir",
      "/data/bin",
      "--prune",
      "--manifest",
      "/data/.gantree-fetch.toml",
    ]);
    const fetchToml = readFileSync(join(dataDir, ".gantree-fetch.toml"), "utf8");
    expect(fetchToml).toContain("github.com/shotah/mcp-gemini-search");
    expect(fetchToml).not.toMatch(/zchee/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("fetchNeedsReload", () => {
  it("reloads after fetch even when bins were already on disk", () => {
    expect(fetchNeedsReload("tools-fetch: done installed=2 skipped=0 total=2")).toBe(true);
    expect(fetchNeedsReload("tools-fetch finished")).toBe(true);
    expect(fetchNeedsReload("tools-fetch: no download_url servers in manifest")).toBe(false);
    expect(fetchNeedsReload("tools-fetch: done installed=0 skipped=3 total=3")).toBe(true);
  });
});
