import { describe, expect, it } from "vitest";
import { envHint, HINTS } from "@/lib/yard/hints";

describe("envHint", () => {
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
    expect(envHint("RENTCAST_API_KEY").hint).toMatch(/RentCast/);
  });

  it("names USER_GOOGLE_EMAIL as the workspace account, not google-search", () => {
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/workspace/i);
    expect(envHint("USER_GOOGLE_EMAIL").hint).toMatch(/not required for google-search/i);
    expect(envHint("USER_GOOGLE_EMAIL").example).toMatch(/@/);
    expect(envHint("GOOGLE_PSE_API_KEY").hint).toMatch(/search_query/);
  });

  it("names google-search Vertex and model params", () => {
    expect(envHint("GEMINI_API_KEY").hint).toMatch(/google-search/);
    expect(envHint("GOOGLE_API_KEY").hint).toMatch(/GEMINI_API_KEY/);
    expect(envHint("GEMINI_MODEL").hint).toMatch(/model/);
    expect(envHint("GOOGLE_GENAI_USE_VERTEXAI").hint).toMatch(/Vertex/);
    expect(envHint("GOOGLE_CLOUD_PROJECT").hint).toMatch(/GOOGLE_GENAI_USE_VERTEXAI/);
    expect(envHint("GOOGLE_CLOUD_LOCATION").hint).toMatch(/global/i);
  });
});
