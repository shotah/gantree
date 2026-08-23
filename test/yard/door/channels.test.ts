import { describe, expect, it } from "vitest";
import {
  parseChannelIds,
  parseOperatorChannels,
  parseRole,
  validateDescription,
  validateDisplayName,
  validateEmail,
} from "@/lib/yard/door/channels";

describe("operator channel ids", () => {
  it("keeps numeric telegram/discord and slack member ids, drops @handles", () => {
    expect(parseChannelIds("telegram", "1, 1 @alice 2")).toEqual({ ok: false, error: "telegram needs the platform id, not @username" });
    expect(parseChannelIds("telegram", ["123", "123", "-100"])).toEqual({ ok: true, ids: ["123", "-100"] });
    expect(parseChannelIds("discord", "123456789012345678")).toEqual({ ok: true, ids: ["123456789012345678"] });
    expect(parseChannelIds("discord", "abc")).toEqual({ ok: false, error: "discord ids are numeric" });
    expect(parseChannelIds("slack", "U012ABCDEF")).toEqual({ ok: true, ids: ["U012ABCDEF"] });
    expect(parseChannelIds("slack", "@here")).toEqual({ ok: false, error: "slack needs the platform id, not @username" });
  });

  it("parses stored json and ignores junk", () => {
    expect(parseOperatorChannels(`{"telegram":["9"],"slack":["12"]}`)).toEqual({
      telegram: ["9"],
      slack: [],
      discord: [],
    });
    expect(parseOperatorChannels("not-json")).toEqual({ telegram: [], slack: [], discord: [] });
    expect(parseRole("readonly")).toBe("readonly");
    expect(parseRole("owner")).toBeNull();
    expect(validateEmail("")).toBeNull();
    expect(validateEmail("bob@yard.example")).toBeNull();
    expect(validateEmail("nope")).toBe("email looks wrong");
  });

  it("rejects control characters in display name and description", () => {
    expect(validateDisplayName("Ada")).toBeNull();
    expect(validateDisplayName("Ada\u0000")).toBe("display name cannot contain control characters");
    expect(validateDisplayName("Ada\nLovelace")).toBe("display name cannot contain control characters");
    expect(validateDescription("ok\nwrap")).toBeNull();
    expect(validateDescription("ok\tcol")).toBeNull();
    expect(validateDescription("bell\u0007")).toBe("description cannot contain control characters");
  });
});
