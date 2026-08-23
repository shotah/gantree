import { describe, expect, it } from "vitest";
import { envHint, HINTS } from "@/lib/yard/hints";

describe("envHint", () => {
  it("describes the Telegram bot token and what it looks like", () => {
    expect(envHint("TELEGRAM_BOT_TOKEN")).toEqual(HINTS.botToken);
    expect(HINTS.botToken.hint).toMatch(/BotFather/);
    expect(HINTS.botToken.example).toMatch(/^\d+:AAH/);
  });

  it("falls back for a granted-tool key we have not named", () => {
    const h = envHint("RENTCAST_API_KEY");
    expect(h.hint).toMatch(/granted tool/);
    expect(h.example).toBeUndefined();
  });
});
