import { resolve } from "node:path";
import { getGantry } from "../crane/inventory";
import { execGantry } from "../host/docker";
import { parseMcpToml, readText, stringifyMcpToml, writeText } from "../host/files";
import type { AuthFlow, GantryCard } from "../types";
import { loadCatalog } from "./catalog";
import { enrichDownloadUrls } from "./grant";

export type AuthOp = "start" | "exchange" | "wait";

export type AuthResult = { ok: boolean; detail: string; url: string | null };

export function authCmd(server: string, op: AuthOp, code?: string, flow?: AuthFlow): string[] {
  if (op === "wait") {
    return ["auth", server, "wait"];
  }
  if (op === "exchange") {
    const trimmed = (code ?? "").trim();
    return flow === "pkce" || flow === "mfa" ? ["auth", server, "exchange", trimmed] : ["auth", server, trimmed];
  }
  if (flow === "device") {
    return ["auth", server];
  }
  return ["auth", server, "url"];
}

export function extractAuthUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"]+/);
  if (!m) {
    return null;
  }
  return m[0].replace(/[.,;:]+$/, "");
}

async function runAuth(slug: string, args: string[]): Promise<AuthResult> {
  const g = await getGantry(slug);
  if (!g?.containerId) {
    return { ok: false, detail: "no running container", url: null };
  }
  if (g.state !== "running") {
    return { ok: false, detail: `container is ${g.state}`, url: null };
  }
  const result = await execGantry(g.containerId, args);
  if (!result) {
    return {
      ok: false,
      detail: "could not exec gantry auth — kick /auth in Telegram and paste the code here.",
      url: null,
    };
  }
  const url = extractAuthUrl(result.text);
  const detail =
    result.text ||
    (result.exitCode === 0
      ? `gantry ${args.join(" ")} finished.`
      : `gantry ${args.join(" ")} exited ${result.exitCode}`);
  return { ok: result.exitCode === 0, detail, url };
}

export async function kickAuth(slug: string, server: string, flow?: AuthFlow): Promise<AuthResult> {
  const started = await runAuth(slug, authCmd(server, "start", undefined, flow));
  if (started.ok || started.url) {
    return started;
  }
  if (flow === "device") {
    return started;
  }
  return runAuth(slug, ["auth", server]);
}

export async function exchangeAuth(slug: string, server: string, code: string, flow?: AuthFlow): Promise<AuthResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, detail: "paste the code from the catch page (or /auth in chat)", url: null };
  }
  const first = await runAuth(slug, authCmd(server, "exchange", trimmed, flow));
  if (first.ok) {
    return first;
  }
  return runAuth(slug, ["auth", server, trimmed]);
}

export async function waitAuth(slug: string, server: string): Promise<AuthResult> {
  return runAuth(slug, authCmd(server, "wait"));
}

/** True when fetch finished — even installed=0, the boot snapshot may still say no_binary. */
export function fetchNeedsReload(detail: string): boolean {
  if (/no download_url servers/i.test(detail)) {
    return false;
  }
  return /tools-fetch: done/i.test(detail) || detail === "tools-fetch finished" || /installed=\d+/i.test(detail);
}

const FETCH_MANIFEST = ".gantree-fetch.toml";

function toolsFetchArgs(g: Pick<GantryCard, "mcpManifest" | "dataDir">): string[] {
  const listed = parseMcpToml(readText(g.mcpManifest));
  const base = ["tools-fetch", "--outdir", "/data/bin", "--prune", "--manifest", "/etc/gantry/mcp.toml"];
  if (listed.length === 0) {
    return base;
  }
  const enriched = enrichDownloadUrls(listed, loadCatalog());
  const filled = listed.some((s) => {
    const hit = enriched.find((e) => e.name === s.name);
    return Boolean(hit?.download_url && hit.download_url !== s.download_url);
  });
  if (filled && g.dataDir) {
    writeText(resolve(g.dataDir, FETCH_MANIFEST), stringifyMcpToml(enriched));
    return ["tools-fetch", "--outdir", "/data/bin", "--prune", "--manifest", `/data/${FETCH_MANIFEST}`];
  }
  return base;
}

export async function toolsFetch(slug: string): Promise<{ ok: boolean; detail: string }> {
  const g = await getGantry(slug);
  if (!g?.containerId || g.state !== "running") {
    return { ok: false, detail: "container must be running for tools-fetch" };
  }
  const result = await execGantry(g.containerId, toolsFetchArgs(g));
  if (!result) {
    return { ok: false, detail: "could not exec gantry tools-fetch" };
  }
  return {
    ok: result.exitCode === 0,
    detail: result.text || (result.exitCode === 0 ? "tools-fetch finished" : `tools-fetch exited ${result.exitCode}`),
  };
}
