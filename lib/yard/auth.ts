import { execGantry } from "./docker";
import { getGantry } from "./inventory";
import type { AuthFlow } from "./types";

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

export async function toolsFetch(slug: string): Promise<{ ok: boolean; detail: string }> {
  const g = await getGantry(slug);
  if (!g?.containerId || g.state !== "running") {
    return { ok: false, detail: "container must be running for tools-fetch" };
  }
  const result = await execGantry(g.containerId, [
    "tools-fetch",
    "--outdir",
    "/data/bin",
    "--manifest",
    "/etc/gantry/mcp.toml",
  ]);
  if (!result) {
    return { ok: false, detail: "could not exec gantry tools-fetch" };
  }
  return {
    ok: result.exitCode === 0,
    detail: result.text || (result.exitCode === 0 ? "tools-fetch finished" : `tools-fetch exited ${result.exitCode}`),
  };
}
