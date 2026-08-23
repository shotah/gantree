import { describe, expect, it } from "vitest";
import { envRow, fieldValue, looksLikeUrl, SECRET_NAME } from "@/app/components/crane/agentEnv";

describe("agentEnv", () => {
  it("treats TOKEN/KEY names as secrets when the row is missing", () => {
    expect(SECRET_NAME.test("TELEGRAM_BOT_TOKEN")).toBe(true);
    expect(envRow("TELEGRAM_BOT_TOKEN").secret).toBe(true);
    expect(envRow("LLM_BASE_URL").secret).toBe(false);
  });

  it("shows a draft over a stored secret, and blanks stored secrets", () => {
    const secret = { set: true, secret: true, value: "hidden" };
    expect(fieldValue("TELEGRAM_BOT_TOKEN", secret, {})).toBe("");
    expect(fieldValue("TELEGRAM_BOT_TOKEN", secret, { TELEGRAM_BOT_TOKEN: "new" })).toBe("new");
    expect(fieldValue("LLM_BASE_URL", { set: true, secret: false, value: "http://x" }, {})).toBe("http://x");
  });

  it("accepts only http(s) for looksLikeUrl", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeUrl("not-a-url")).toBe(false);
  });
});
