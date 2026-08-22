import { describe, expect, it } from "vitest";
import { maskEnv, mergeEnv, parseEnvFile, stringifyEnvFile } from "./envfile";

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
  });
});
