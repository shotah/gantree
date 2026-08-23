import { describe, expect, it } from "vitest";
import { phoneFrameSrc } from "@/app/lib/phonePreview";

describe("phoneFrameSrc", () => {
  it("is off with no query", () => {
    expect(phoneFrameSrc("/gantries/kit")).toEqual({ on: false, src: "/gantries/kit" });
  });

  it("stays off without GANTREE_DEV even when ?phone=1", () => {
    expect(phoneFrameSrc("/gantries/kit", "?phone=1")).toEqual({ on: false, src: "/gantries/kit" });
  });

  it("strips phone so the iframe cannot nest", () => {
    expect(phoneFrameSrc("/gantries/kit", "?phone=1", true)).toEqual({ on: true, src: "/gantries/kit" });
    expect(phoneFrameSrc("/", "phone", true)).toEqual({ on: true, src: "/" });
  });

  it("keeps other query params", () => {
    expect(phoneFrameSrc("/", "?phone=1&window=6h", true)).toEqual({ on: true, src: "/?window=6h" });
  });
});
