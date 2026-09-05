import { describe, expect, it } from "vitest";
import { envHint, HINTS } from "@/lib/yard/hints";

describe("envHint", () => {
  it("describes pendant mailbox secrets", () => {
    expect(envHint("PENDANT_BEARER").hint).toMatch(/bearer/i);
    expect(envHint("PENDANT_MAILBOX_URL").hint).toMatch(/wss/);
    expect(HINTS.pendantAllowlist.hint).toMatch(/Google sub/);
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

  it("names USER_GOOGLE_EMAIL as the workspace account, not google-search", () => {
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/workspace/i);
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/not required for google-search/i);
    expect(envHint("USER_GOOGLE_EMAIL").example).toMatch(/@/);
    expect(envHint("GOOGLE_PSE_API_KEY").hint).toMatch(/search_query/);
  });

  it("names google-search Vertex and model params", () => {
    expect(envHint("GEMINI_SEARCH_API_KEY").hint).toMatch(/LLM_API_KEY/);
    expect(envHint("GEMINI_SEARCH_MODEL").hint).toMatch(/LLM_MODEL/);
    expect(envHint("GEMINI_SEARCH_MODEL").example).toBe("gemini-3.6-flash");
    expect(envHint("GOOGLE_GENAI_USE_VERTEXAI").hint).toMatch(/Vertex/);
    expect(envHint("GOOGLE_CLOUD_PROJECT").hint).toMatch(/GOOGLE_GENAI_USE_VERTEXAI/);
    expect(envHint("GOOGLE_CLOUD_LOCATION").hint).toMatch(/global/i);
  });
});
