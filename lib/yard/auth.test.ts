import { describe, expect, it } from "vitest";
import { authCmd, extractAuthUrl } from "./auth";

describe("authCmd", () => {
  it("starts PKCE with url and exchanges with the code", () => {
    expect(authCmd("google", "start", undefined, "pkce")).toEqual(["auth", "google", "url"]);
    expect(authCmd("google", "exchange", "abc", "pkce")).toEqual(["auth", "google", "exchange", "abc"]);
  });

  it("uses device wait for youtube", () => {
    expect(authCmd("youtube", "start", undefined, "device")).toEqual(["auth", "youtube"]);
    expect(authCmd("youtube", "wait")).toEqual(["auth", "youtube", "wait"]);
  });
});

describe("extractAuthUrl", () => {
  it("picks the first http(s) URL", () => {
    expect(extractAuthUrl("open https://accounts.google.com/o/oauth2?x=1 then paste")).toBe(
      "https://accounts.google.com/o/oauth2?x=1",
    );
  });
});
