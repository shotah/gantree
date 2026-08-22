import { describe, expect, it } from "vitest";
import { craneUser, looksLikeGantry, mergeBinds, normalizeName, stateOf } from "./docker";

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

describe("craneUser", () => {
  it("keeps a host uid from inspect", () => {
    expect(craneUser("1000:1000")).toBe("1000:1000");
  });

  it("drops distroless nonroot so host-owned data/ stays writable", () => {
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    if (uid == null || gid == null || uid === 0) {
      expect(craneUser("65532:65532")).toBeUndefined();
      return;
    }
    expect(craneUser("65532:65532")).toBe(`${uid}:${gid}`);
    expect(craneUser("")).toBe(`${uid}:${gid}`);
    expect(craneUser("nonroot")).toBe(`${uid}:${gid}`);
  });

  it("uses GANTREE_CRANE_USER when the console is root-in-docker", () => {
    const prev = process.env.GANTREE_CRANE_USER;
    process.env.GANTREE_CRANE_USER = "1000:1000";
    expect(craneUser("65532:65532")).toBe("1000:1000");
    if (prev === undefined) {
      delete process.env.GANTREE_CRANE_USER;
    } else {
      process.env.GANTREE_CRANE_USER = prev;
    }
  });
});

describe("mergeBinds", () => {
  it("keeps extra host binds and replaces dest collisions", () => {
    expect(
      mergeBinds(
        ["/opt/agents/kit/data:/data", "/opt/agents/kit/persona:/persona"],
        ["/old/data:/data", "/dev/snd:/dev/snd"],
      ),
    ).toEqual(["/opt/agents/kit/data:/data", "/opt/agents/kit/persona:/persona", "/dev/snd:/dev/snd"]);
  });
});
