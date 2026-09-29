import { readdirSync, statSync, unlinkSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { loadEnvFile, writeEnvFile } from "../host/envfile";

/** `{email}.json` under google-mcp's credential dir. Filenames only — never the token JSON. */
const EMAIL_FILE = /^[^\s@/\\]+@[^\s@/\\]+\.[^\s@/\\]+$/;

export function googleCredentialDir(dataDir: string): string {
  return resolve(dataDir, ".google_workspace_mcp", "credentials");
}

export function googleAccountEmail(filename: string): string | null {
  if (filename.includes("/") || filename.includes("\\") || !filename.endsWith(".json")) {
    return null;
  }
  const email = filename.slice(0, -".json".length).trim().toLowerCase();
  if (!email || email.includes("..") || !EMAIL_FILE.test(email)) {
    return null;
  }
  return email;
}

/** Signed-in Workspace addresses, from credential filenames. Empty when the dir is missing. */
export function listGoogleAccounts(dataDir: string | null | undefined): string[] {
  if (!dataDir) {
    return [];
  }
  const dir = googleCredentialDir(dataDir);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    const email = googleAccountEmail(name);
    if (!email) {
      continue;
    }
    try {
      if (!statSync(resolve(dir, name)).isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    if (!out.includes(email)) {
      out.push(email);
    }
  }
  return out.sort();
}

export function removeGoogleAccount(
  dataDir: string,
  email: string,
): { ok: true } | { ok: false; error: string } {
  const want = googleAccountEmail(`${email.trim().toLowerCase()}.json`);
  if (!want) {
    return { ok: false, error: "bad email" };
  }
  const dir = googleCredentialDir(dataDir);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return { ok: false, error: "no credential directory" };
  }
  const hit = names.find((n) => n.toLowerCase() === `${want}.json`);
  if (!hit) {
    return { ok: false, error: "account not found" };
  }
  const file = resolve(dir, hit);
  const rel = relative(dir, file);
  if (!rel || isAbsolute(rel) || rel.startsWith("..")) {
    return { ok: false, error: "account not found" };
  }
  try {
    if (!statSync(file).isFile()) {
      return { ok: false, error: "account not found" };
    }
    unlinkSync(file);
  } catch {
    return { ok: false, error: "could not delete that account" };
  }
  return { ok: true };
}

/** Drop USER_GOOGLE_EMAIL when it names this address. Returns whether the env file changed. */
export function clearGoogleDefaultIf(envFile: string | null, email: string): boolean {
  if (!envFile) {
    return false;
  }
  const env = loadEnvFile(envFile);
  const cur = (env.USER_GOOGLE_EMAIL ?? "").trim().toLowerCase();
  if (!cur || cur !== email.trim().toLowerCase()) {
    return false;
  }
  delete env.USER_GOOGLE_EMAIL;
  writeEnvFile(envFile, env);
  return true;
}

/** Pin or clear the default Workspace account. A pin must already be a signed-in filename. */
export function setGoogleDefault(
  envFile: string,
  email: string | null,
  accounts: readonly string[],
): { ok: true } | { ok: false; error: string } {
  const env = loadEnvFile(envFile);
  if (!email || !email.trim()) {
    delete env.USER_GOOGLE_EMAIL;
    writeEnvFile(envFile, env);
    return { ok: true };
  }
  const want = email.trim().toLowerCase();
  if (!accounts.includes(want)) {
    return { ok: false, error: "that account is not signed in" };
  }
  env.USER_GOOGLE_EMAIL = want;
  writeEnvFile(envFile, env);
  return { ok: true };
}
