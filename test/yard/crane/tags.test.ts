import { describe, expect, it } from "vitest";
import {
  coerceTagColors,
  coerceTags,
  parseTag,
  parseTagColor,
  parseTagColors,
  parseTags,
  TAG_MAX,
} from "@/lib/yard/crane/tags";

describe("parseTag", () => {
  it("squeezes case and spaces into a slug", () => {
    expect(parseTag("Home")).toBe("home");
    expect(parseTag(" bills me ")).toBe("bills-me");
    expect(parseTag("gemini.keys")).toBe("gemini.keys");
  });

  it("refuses empty, symbols, and over-long labels", () => {
    expect(parseTag("")).toBeNull();
    expect(parseTag("  ")).toBeNull();
    expect(parseTag("1home")).toBeNull();
    expect(parseTag("home!")).toBeNull();
    expect(parseTag("a".repeat(25))).toBeNull();
  });
});

describe("parseTags", () => {
  it("dedupes and accepts a comma string", () => {
    expect(parseTags(["Home", "home", "guest"])).toEqual({ ok: true, tags: ["home", "guest"] });
    expect(parseTags("home, guest")).toEqual({ ok: true, tags: ["home", "guest"] });
    expect(parseTags(null)).toEqual({ ok: true, tags: [] });
  });

  it("refuses a bad label instead of silently dropping it", () => {
    expect(parseTags(["home!"])).toMatchObject({ ok: false });
    expect(parseTags({ no: "list" })).toMatchObject({ ok: false });
    expect(parseTags(Array.from({ length: TAG_MAX + 1 }, (_, i) => `t${i}`))).toMatchObject({ ok: false });
  });
});

describe("coerceTags", () => {
  it("keeps the yard up when toml has junk mixed in", () => {
    expect(coerceTags(["home", "NOPE!", 3, "guest"])).toEqual(["home", "guest"]);
    expect(coerceTags(undefined)).toEqual([]);
  });
});

describe("parseTagColor", () => {
  it("accepts palette names case-insensitively", () => {
    expect(parseTagColor("Red")).toBe("red");
    expect(parseTagColor("green")).toBe("green");
  });

  it("refuses unknown hues", () => {
    expect(parseTagColor("pink")).toBeNull();
    expect(parseTagColor(1)).toBeNull();
  });
});

describe("parseTagColors", () => {
  it("squeezes keys and hues", () => {
    expect(parseTagColors({ Home: "RED", guest: "green" })).toEqual({
      ok: true,
      colors: { home: "red", guest: "green" },
    });
    expect(parseTagColors(null)).toEqual({ ok: true, colors: {} });
  });

  it("refuses a bad hue so the operator sees why it did not stick", () => {
    expect(parseTagColors({ home: "pink" })).toMatchObject({ ok: false });
    expect(parseTagColors(["red"])).toMatchObject({ ok: false });
  });
});

describe("coerceTagColors", () => {
  it("drops unknown labels and hues so a bad [tag_color] cannot blank the board", () => {
    expect(coerceTagColors({ home: "red", nope: "pink", "1bad": "green" })).toEqual({ home: "red" });
    expect(coerceTagColors(undefined)).toEqual({});
  });
});
