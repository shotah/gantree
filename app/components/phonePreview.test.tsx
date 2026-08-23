import { describe, expect, it } from "vitest";
import { phoneFrameSrc } from "./phonePreview";

describe("phoneFrameSrc", () => {
  it("is off with no query", () => {
    expect(phoneFrameSrc("/gantries/kit")).toEqual({ on: false, src: "/gantries/kit" });
  });

  it("strips phone so the iframe cannot nest", () => {
    expect(phoneFrameSrc("/gantries/kit", "?phone=1")).toEqual({ on: true, src: "/gantries/kit" });
    expect(phoneFrameSrc("/", "phone")).toEqual({ on: true, src: "/" });
  });

  it("keeps other query params", () => {
    expect(phoneFrameSrc("/", "?phone=1&window=6h")).toEqual({ on: true, src: "/?window=6h" });
  });
});
