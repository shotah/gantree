import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, maskEnv, mergeEnv, parseEnvFile, stringifyEnvFile, writeEnvFile } from "@/lib/yard/host/envfile";
import { dropInactiveMouthKeys } from "@/lib/yard/tools/packages";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("envfile", () => {
  it("round-trips keys", () => {
    const text = stringifyEnvFile({ CHANNEL: "telegram", LLM_MODEL: "dummy" });
    expect(parseEnvFile(text)).toEqual({ CHANNEL: "telegram", LLM_MODEL: "dummy" });
  });

  it("masks secrets and keeps empty patch from wiping them", () => {
    const masked = maskEnv({ TELEGRAM_BOT_TOKEN: "abc", CHANNEL: "telegram", PENDANT_BEARER: "tok" });
    expect(masked.TELEGRAM_BOT_TOKEN).toEqual({ set: true, secret: true, value: "" });
    expect(masked.PENDANT_BEARER).toEqual({ set: true, secret: true, value: "" });
    expect(masked.CHANNEL?.value).toBe("telegram");
    expect(mergeEnv({ TELEGRAM_BOT_TOKEN: "abc" }, { TELEGRAM_BOT_TOKEN: "" })).toEqual({
      TELEGRAM_BOT_TOKEN: "abc",
    });
    expect(mergeEnv({ GARMIN_PASSWORD: "x" }, { GARMIN_PASSWORD: "" })).toEqual({
      GARMIN_PASSWORD: "x",
    });
    expect(mergeEnv({ CHANNEL: "a" }, { CHANNEL: "b" })).toEqual({ CHANNEL: "b" });
    expect(mergeEnv({ LLM_BASE_URL: "nura-assaf" }, { LLM_BASE_URL: "https://example.test/v1" })).toEqual({
      LLM_BASE_URL: "https://example.test/v1",
    });
  });

  it("loads and writes a file, skipping junk lines", () => {
    expect(loadEnvFile(null)).toEqual({});
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const path = join(root, ".env");
    writeEnvFile(path, { CHANNEL: "stdio" });
    expect(loadEnvFile(path)).toEqual({ CHANNEL: "stdio" });
    expect(parseEnvFile("# c\n\nNOEQ\n=bad\nOK=1\n")).toEqual({ OK: "1" });
  });

  it("drops telegram/discord/slack keys when CHANNEL is another mouth", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const path = join(root, ".env");
    writeEnvFile(path, {
      CHANNEL: "pendant",
      TELEGRAM_BOT_TOKEN: "123:abc",
      TELEGRAM_ALLOWED_USERS: "99",
      DISCORD_BOT_TOKEN: "d",
      PENDANT_BEARER: "keep-me",
      LLM_API_KEY: "k",
    });
    expect(loadEnvFile(path)).toEqual({
      CHANNEL: "pendant",
      PENDANT_BEARER: "keep-me",
      LLM_API_KEY: "k",
    });
    expect(dropInactiveMouthKeys({ CHANNEL: "telegram", TELEGRAM_BOT_TOKEN: "t", DISCORD_BOT_TOKEN: "d" })).toEqual({
      CHANNEL: "telegram",
      TELEGRAM_BOT_TOKEN: "t",
    });
    expect(dropInactiveMouthKeys({ TELEGRAM_BOT_TOKEN: "abc" }).TELEGRAM_BOT_TOKEN).toBe("abc");
  });

  it("drops prior search keys on load and write", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    const path = join(root, ".env");
    writeEnvFile(path, {
      CHANNEL: "telegram",
      BRAVE_SEARCH_API_KEY: "brave",
      GEMINI_SEARCH_API_KEY: "old-gemini",
      GEMINI_SEARCH_MODEL: "gemini-3.6-flash",
      GOOGLE_PSE_API_KEY: "pse",
      GOOGLE_PSE_ENGINE_ID: "cx",
    });
    expect(loadEnvFile(path)).toEqual({
      CHANNEL: "telegram",
      BRAVE_SEARCH_API_KEY: "brave",
    });
    expect(parseEnvFile(readFileSync(path, "utf8"))).toEqual({
      CHANNEL: "telegram",
      BRAVE_SEARCH_API_KEY: "brave",
    });
    writeFileSync(path, "CHANNEL=telegram\nGOOGLE_PSE_API_KEY=pse\nGEMINI_SEARCH_API_KEY=old\n");
    expect(loadEnvFile(path)).toEqual({ CHANNEL: "telegram" });
    writeEnvFile(path, loadEnvFile(path));
    expect(parseEnvFile(readFileSync(path, "utf8"))).toEqual({ CHANNEL: "telegram" });
  });
});
