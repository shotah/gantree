import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHONE_PRESET,
  PHONE_PRESETS,
  phoneFrameSrc,
  phonePreset,
  phonePreviewHref,
} from "@/app/lib/phonePreview";

describe("phoneFrameSrc", () => {
  it("is off with no query", () => {
    expect(phoneFrameSrc("/gantries/kit")).toEqual({
      on: false,
      src: "/gantries/kit",
      preset: DEFAULT_PHONE_PRESET,
    });
  });

  it("stays off without GANTREE_DEV even when ?phone=1", () => {
    expect(phoneFrameSrc("/gantries/kit", "?phone=1")).toEqual({
      on: false,
      src: "/gantries/kit",
      preset: DEFAULT_PHONE_PRESET,
    });
  });

  it("strips phone so the iframe cannot nest", () => {
    expect(phoneFrameSrc("/gantries/kit", "?phone=1", true)).toEqual({
      on: true,
      src: "/gantries/kit",
      preset: DEFAULT_PHONE_PRESET,
    });
    expect(phoneFrameSrc("/", "phone", true)).toEqual({
      on: true,
      src: "/",
      preset: DEFAULT_PHONE_PRESET,
    });
  });

  it("keeps other query params", () => {
    expect(phoneFrameSrc("/", "?phone=1&window=6h", true)).toEqual({
      on: true,
      src: "/?window=6h",
      preset: DEFAULT_PHONE_PRESET,
    });
  });

  it("picks a named preset and still strips phone", () => {
    expect(phoneFrameSrc("/", "?phone=iphone-max&window=6h", true)).toEqual({
      on: true,
      src: "/?window=6h",
      preset: phonePreset("iphone-max"),
    });
  });
});

describe("phonePreset", () => {
  it("treats 1, empty, and unknown as iPhone", () => {
    expect(phonePreset("1").id).toBe("iphone");
    expect(phonePreset("")).toBe(DEFAULT_PHONE_PRESET);
    expect(phonePreset(null)).toBe(DEFAULT_PHONE_PRESET);
    expect(phonePreset("tablet")).toBe(DEFAULT_PHONE_PRESET);
  });

  it("has five device sizes", () => {
    expect(PHONE_PRESETS.map((p) => p.id)).toEqual([
      "android-small",
      "iphone-se",
      "iphone",
      "android",
      "iphone-max",
    ]);
    expect(new Set(PHONE_PRESETS.map((p) => `${p.width}x${p.height}`)).size).toBe(5);
  });
});

describe("phonePreviewHref", () => {
  it("sets the preset and keeps other params", () => {
    expect(phonePreviewHref("/", "phone=1&window=6h", "android-small")).toBe(
      "/?phone=android-small&window=6h",
    );
    expect(phonePreviewHref("/gantries/kit", "", "iphone-max")).toBe(
      "/gantries/kit?phone=iphone-max",
    );
  });
});
