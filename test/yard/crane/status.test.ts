import { describe, expect, it } from "vitest";
import {
  cmpGantryVersion,
  fmtGantryBuild,
  gantryBehind,
  newestGantryVersion,
  parseGantryStatusJson,
  shortImageId,
} from "@/lib/yard/crane/status";

describe("parseGantryStatusJson", () => {
  it("keeps version and commit off the binary, not the compose tag", () => {
    const parsed = parseGantryStatusJson(
      'noise\n{"ok":true,"alive":true,"version":"1.2.0","commit":"cafebabe","channel":"telegram"}\n',
    );
    expect(parsed?.version).toBe("1.2.0");
    expect(parsed?.commit).toBe("cafebabe");
  });

  it("refuses text that is not status JSON", () => {
    expect(parseGantryStatusJson("ok: channel telegram")).toBeNull();
  });
});

describe("shortImageId", () => {
  it("strips sha256 and keeps 12 hex chars", () => {
    expect(shortImageId("sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")).toBe("0123456789ab");
    expect(shortImageId("abc")).toBe("abc");
    expect(shortImageId("")).toBeNull();
  });
});

describe("fmtGantryBuild", () => {
  it("prefers version · commit, then image id, and drops commit none", () => {
    expect(fmtGantryBuild({ version: "1.2.0", commit: "cafebabe" })).toBe("1.2.0 · cafebabe");
    expect(fmtGantryBuild({ version: "1.2.0", commit: "none" })).toBe("1.2.0");
    expect(fmtGantryBuild({ imageId: "0123456789ab" })).toBe("0123456789ab");
    expect(fmtGantryBuild({})).toBeNull();
  });
});

describe("gantryBehind", () => {
  it("compares semver against the newest peer, including a missing version", () => {
    expect(newestGantryVersion(["0.9.0", "v1.2.0", "nope"])).toBe("v1.2.0");
    expect(cmpGantryVersion("0.9.0", "1.2.0")).toBeLessThan(0);
    expect(gantryBehind("0.9.0", "1.2.0")).toBe(true);
    expect(gantryBehind("1.2.0", "1.2.0")).toBe(false);
    expect(gantryBehind(null, "1.2.0")).toBe(true);
    expect(gantryBehind("0.9.0", null)).toBe(false);
  });
});
