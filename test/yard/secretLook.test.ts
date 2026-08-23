import { describe, expect, it } from "vitest";
import { SECRET_DOTS, secretBadge, secretLook, secretNoun } from "@/lib/yard/secretLook";

describe("secretLook", () => {
  it("calls out a blank secret instead of looking pre-filled", () => {
    expect(secretLook({ set: false, secret: true })).toEqual({
      type: "text",
      placeholder: "needs a key",
      status: "needs a key",
      missing: true,
    });
    expect(secretLook({ set: false, secret: true }, "", "token")).toMatchObject({
      placeholder: "needs a token",
      status: "needs a token",
      missing: true,
    });
  });

  it("shows dots for a stored secret, and for a typed draft", () => {
    expect(secretLook({ set: true, secret: true })).toEqual({
      type: "password",
      placeholder: SECRET_DOTS,
      status: "set",
      missing: false,
    });
    expect(secretLook({ set: false, secret: true }, "sk-live")).toMatchObject({
      type: "password",
      placeholder: "",
      missing: false,
    });
  });

  it("leaves non-secrets as plain text", () => {
    expect(secretLook({ set: true, secret: false })).toMatchObject({ type: "text", missing: false, status: "set" });
  });
});

describe("secretBadge", () => {
  it("dots a set secret and highlights an empty one", () => {
    expect(secretBadge({ set: true, secret: true })).toEqual({ text: SECRET_DOTS, missing: false });
    expect(secretBadge({ set: false, secret: true })).toEqual({ text: "needs a key", missing: true });
    expect(secretBadge({ set: true, secret: false }, "127.0.0.1")).toEqual({ text: "127.0.0.1", missing: false });
  });
});

describe("secretNoun", () => {
  it("calls a bot token a token", () => {
    expect(secretNoun("TELEGRAM_BOT_TOKEN")).toBe("token");
    expect(secretNoun("LLM_API_KEY")).toBe("key");
  });
});
