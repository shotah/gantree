import { describe, expect, it } from "vitest";
import { looksLikeGantry, normalizeName, stateOf } from "./docker";

describe("looksLikeGantry", () => {
  it("matches hub and local gantry images", () => {
    expect(looksLikeGantry("shotah/ai-gantry:latest", ["kit"])).toBe(true);
    expect(looksLikeGantry("gantry:local", ["gantry"])).toBe(true);
  });

  it("skips the console itself", () => {
    expect(looksLikeGantry("gantree:local", ["gantree"])).toBe(false);
  });
});

describe("normalizeName", () => {
  it("strips the docker slash", () => {
    expect(normalizeName("/kit")).toBe("kit");
  });
});

describe("stateOf", () => {
  it("maps known states", () => {
    expect(stateOf("running")).toBe("running");
    expect(stateOf("weird")).toBe("unknown");
  });
});
