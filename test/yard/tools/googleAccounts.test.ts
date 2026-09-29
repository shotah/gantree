import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, writeEnvFile } from "@/lib/yard/host/envfile";
import {
  clearGoogleDefaultIf,
  listGoogleAccounts,
  removeGoogleAccount,
  setGoogleDefault,
} from "@/lib/yard/tools/googleAccounts";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function creds(): { data: string; env: string } {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  const data = join(root, "data");
  const dir = join(data, ".google_workspace_mcp", "credentials");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "Ada@Example.com.json"), '{"refresh_token":"secret-token"}\n');
  writeFileSync(join(dir, "ada@work.com.json"), "{}\n");
  writeFileSync(join(dir, "notes.txt"), "ignore me\n");
  const env = join(root, ".env");
  writeEnvFile(env, { USER_GOOGLE_EMAIL: "ada@example.com", CHANNEL: "pendant" });
  return { data, env };
}

describe("google accounts", () => {
  it("lists credential filenames and nothing inside them", () => {
    const { data } = creds();
    expect(listGoogleAccounts(data)).toEqual(["ada@example.com", "ada@work.com"]);
    expect(listGoogleAccounts(data).join(" ")).not.toContain("secret-token");
    expect(listGoogleAccounts(null)).toEqual([]);
  });

  it("deletes one file, clears the default when it matches, and leaves the other", () => {
    const { data, env } = creds();
    expect(removeGoogleAccount(data, "ada@example.com")).toEqual({ ok: true });
    expect(clearGoogleDefaultIf(env, "ada@example.com")).toBe(true);
    expect(listGoogleAccounts(data)).toEqual(["ada@work.com"]);
    expect(loadEnvFile(env).USER_GOOGLE_EMAIL).toBeUndefined();
    expect(readFileSync(join(data, ".google_workspace_mcp", "credentials", "ada@work.com.json"), "utf8")).toBe("{}\n");
    expect(removeGoogleAccount(data, "../.env")).toMatchObject({ ok: false });
    expect(removeGoogleAccount(data, "missing@example.com")).toMatchObject({ ok: false });
  });

  it("pins a signed-in address as USER_GOOGLE_EMAIL and refuses one that is not", () => {
    const { data, env } = creds();
    const accounts = listGoogleAccounts(data);
    expect(setGoogleDefault(env, "ada@work.com", accounts)).toEqual({ ok: true });
    expect(loadEnvFile(env).USER_GOOGLE_EMAIL).toBe("ada@work.com");
    expect(setGoogleDefault(env, "other@example.com", accounts)).toMatchObject({ ok: false });
    expect(loadEnvFile(env).USER_GOOGLE_EMAIL).toBe("ada@work.com");
    expect(setGoogleDefault(env, null, accounts)).toEqual({ ok: true });
    expect(loadEnvFile(env).USER_GOOGLE_EMAIL).toBeUndefined();
  });
});
