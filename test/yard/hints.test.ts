import { describe, expect, it } from "vitest";
import { envHint, HINTS } from "@/lib/yard/hints";

describe("envHint", () => {
  it("describes pendant mailbox secrets", () => {
    expect(envHint("PENDANT_BEARER").hint).toMatch(/bearer/i);
    expect(envHint("PENDANT_MAILBOX_URL").hint).toMatch(/wss/);
    expect(HINTS.pendantAllowlist.hint).toMatch(/email is enough/i);
    expect(HINTS.chatGoogle.hint).toMatch(/Leave blank/);
    expect(HINTS.chatGoogle.hint).toMatch(/never writes/i);
    expect(envHint("PENDANT_ALLOWED_USERS").hint).toMatch(/email, Google sub, or sub:email/);
  });

  it("describes the Telegram bot token and what it looks like", () => {
    expect(envHint("TELEGRAM_BOT_TOKEN")).toEqual(HINTS.botToken);
    expect(HINTS.botToken.hint).toMatch(/BotFather/);
    expect(HINTS.botToken.example).toMatch(/^\d+:AAH/);
  });

  it("falls back for a granted-tool key we have not named", () => {
    const h = envHint("SOME_OBSCURE_VENDOR_TOKEN");
    expect(h.hint).toMatch(/granted tool/);
    expect(h.example).toBeUndefined();
  });

  it("names a maps key and a RentCast key", () => {
    expect(envHint("GOOGLE_MAPS_API_KEY").hint).toMatch(/Maps/);
    expect(envHint("BOARDS_AUTHOR").hint).toMatch(/corkboard/);
    expect(envHint("BOARDS_AUTHOR").example).toBe("kit");
    expect(envHint("RENTCAST_API_KEY").hint).toMatch(/RentCast/);
  });

  it("names USER_GOOGLE_EMAIL as the workspace account, not web_search", () => {
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/workspace/i);
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/not required for web_search/i);
    expect(envHint("USER_GOOGLE_EMAIL").example).toMatch(/@/);
    expect(envHint("BRAVE_SEARCH_API_KEY").hint).toMatch(/web_search/);
  });

  it("names Brave Search key for builtin web_search, not a second model", () => {
    expect(envHint("BRAVE_SEARCH_API_KEY").hint).toMatch(/not a second model/i);
    expect(envHint("BRAVE_SEARCH_API_KEY").hint).toMatch(/brave/i);
    expect(envHint("BRAVE_SEARCH_API_KEY").example).toMatch(/dashboard/i);
  });

  it("describes the photo_generate → pendant face/wallpaper handoff dir", () => {
    expect(envHint("IMAGE_OUTPUT_DIR").example).toBe("/data/images");
    expect(envHint("IMAGE_OUTPUT_DIR").hint).toMatch(/source_path/);
    expect(envHint("IMAGE_API_KEY").hint).toMatch(/LLM_API_KEY/);
    expect(envHint("PENDANT_IMAGE_DIR").hint).toMatch(/source_path/);
  });
});
