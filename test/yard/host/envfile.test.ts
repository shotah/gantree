import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, maskEnv, mergeEnv, parseEnvFile, stringifyEnvFile, writeEnvFile } from "@/lib/yard/host/envfile";

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
    const masked = maskEnv({ TELEGRAM_BOT_TOKEN: "abc", CHANNEL: "telegram" });
    expect(masked.TELEGRAM_BOT_TOKEN).toEqual({ set: true, secret: true, value: "" });
    expect(masked.CHANNEL?.value).toBe("telegram");
    expect(mergeEnv({ TELEGRAM_BOT_TOKEN: "abc" }, { TELEGRAM_BOT_TOKEN: "" })).toEqual({
      TELEGRAM_BOT_TOKEN: "abc",
    });
    expect(mergeEnv({ GARMIN_PASSWORD: "x" }, { GARMIN_PASSWORD: "" })).toEqual({
      GARMIN_PASSWORD: "x",
    });
    expect(mergeEnv({ CHANNEL: "a" }, { CHANNEL: "b" })).toEqual({ CHANNEL: "b" });
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
});
