import { existsSync, readFileSync } from "node:fs";
import { writeText } from "./files";

const SECRET_KEYS = new Set([
  "LLM_API_KEY",
  "GEMINI_SEARCH_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "DISCORD_BOT_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
]);

export function isSecretKey(k: string): boolean {
  return SECRET_KEYS.has(k) || /TOKEN|KEY|SECRET|PASSWORD/i.test(k);
}

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq < 1) {
      continue;
    }
    out[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return out;
}

export function loadEnvFile(path: string | null): Record<string, string> {
  if (!path || !existsSync(path)) {
    return {};
  }
  return parseEnvFile(readFileSync(path, "utf8"));
}

export function stringifyEnvFile(env: Record<string, string>): string {
  const keys = Object.keys(env).sort();
  const lines = ["# Written by gantree. Do not commit.", ""];
  for (const k of keys) {
    lines.push(`${k}=${env[k] ?? ""}`);
  }
  return `${lines.join("\n")}\n`;
}

export function writeEnvFile(path: string, env: Record<string, string>): void {
  writeText(path, stringifyEnvFile(env));
}

export function maskEnv(env: Record<string, string>): Record<string, { set: boolean; secret: boolean; value: string }> {
  const out: Record<string, { set: boolean; secret: boolean; value: string }> = {};
  for (const [k, v] of Object.entries(env)) {
    const secret = isSecretKey(k);
    out[k] = { set: v.trim().length > 0, secret, value: secret ? "" : v };
  }
  return out;
}

export function mergeEnv(current: Record<string, string>, patch: Record<string, string>): Record<string, string> {
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === "" && isSecretKey(k)) {
      continue;
    }
    next[k] = v;
  }
  return next;
}
