import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catchUpPin,
  isDockerHubRepo,
  isExactSemverTag,
  isMovingImageTag,
  newestHubSemver,
  parseImageRef,
  pullResolvedImage,
  resetHubTagCache,
  resolveHubImage,
  type HubGet,
} from "@/lib/yard/host/hubImage";
import { DEFAULT_IMAGE } from "@/lib/yard/types";

afterEach(() => {
  resetHubTagCache();
});

function hubGet(pages: Record<string, unknown>): HubGet {
  return async (url) => {
    const body = pages[url];
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => body };
  };
}

describe("parseImageRef", () => {
  it("splits repo and tag, defaulting an untagged name to latest", () => {
    expect(parseImageRef("shotah/ai-gantry:latest")).toEqual({ name: "shotah/ai-gantry", tag: "latest" });
    expect(parseImageRef("shotah/ai-gantry")).toEqual({ name: "shotah/ai-gantry", tag: "latest" });
    expect(parseImageRef("shotah/ai-gantry:1.1.112")).toEqual({ name: "shotah/ai-gantry", tag: "1.1.112" });
    expect(parseImageRef("localhost:5000/foo")).toEqual({ name: "localhost:5000/foo", tag: "latest" });
    expect(parseImageRef("shotah/ai-gantry@sha256:abc")).toEqual({ name: "shotah/ai-gantry@sha256:abc", tag: "" });
  });
});

describe("hub tag filters", () => {
  it("treats latest and edge as moving, and only X.Y.Z as semver", () => {
    expect(isMovingImageTag("latest")).toBe(true);
    expect(isMovingImageTag("EDGE")).toBe(true);
    expect(isMovingImageTag("1.1.112")).toBe(false);
    expect(isExactSemverTag("1.1.112")).toBe(true);
    expect(isExactSemverTag("v1.1.112")).toBe(true);
    expect(isExactSemverTag("1.1")).toBe(false);
    expect(isExactSemverTag("edge")).toBe(false);
    expect(isExactSemverTag("1.1.112-rc.1")).toBe(false);
    expect(isDockerHubRepo("shotah/ai-gantry")).toBe(true);
    expect(isDockerHubRepo("ghcr.io/shotah/ai-gantry")).toBe(false);
    expect(isDockerHubRepo("nginx")).toBe(false);
  });

  it("picks the newest full semver and ignores moving / sha / major.minor tags", () => {
    expect(newestHubSemver(["latest", "edge", "1.1", "sha-deadbee", "1.1.100", "1.1.112", "1.0.9"])).toBe("1.1.112");
    expect(newestHubSemver(["edge", "latest"])).toBeNull();
  });

  it("rewrites a Hub pin to :latest for board catch-up", () => {
    expect(catchUpPin("shotah/ai-gantry:1.0.0")).toBe("shotah/ai-gantry:latest");
    expect(catchUpPin("shotah/ai-gantry:edge")).toBe("shotah/ai-gantry:latest");
    expect(catchUpPin(null)).toBe(DEFAULT_IMAGE);
    expect(catchUpPin("ghcr.io/shotah/ai-gantry:edge")).toBe("ghcr.io/shotah/ai-gantry:edge");
  });
});

describe("resolveHubImage", () => {
  it("resolves latest and edge to the newest Hub semver", async () => {
    const get = hubGet({
      "https://hub.docker.com/v2/repositories/shotah/ai-gantry/tags?page_size=100": {
        next: "https://hub.docker.com/v2/repositories/shotah/ai-gantry/tags?page_size=100&page=2",
        results: [{ name: "latest" }, { name: "edge" }, { name: "1.1" }],
      },
      "https://hub.docker.com/v2/repositories/shotah/ai-gantry/tags?page_size=100&page=2": {
        next: null,
        results: [{ name: "1.1.112" }, { name: "sha-deadbee" }],
      },
    });
    expect(await resolveHubImage("shotah/ai-gantry:latest", get)).toBe("shotah/ai-gantry:1.1.112");
    expect(await resolveHubImage("shotah/ai-gantry:edge", get)).toBe("shotah/ai-gantry:1.1.112");
  });

  it("leaves an explicit semver or non-Hub pin alone", async () => {
    const get = vi.fn(hubGet({}));
    expect(await resolveHubImage("shotah/ai-gantry:1.1.112", get)).toBe("shotah/ai-gantry:1.1.112");
    expect(await resolveHubImage("ghcr.io/shotah/ai-gantry:latest", get)).toBe("ghcr.io/shotah/ai-gantry:latest");
    expect(get).not.toHaveBeenCalled();
  });

  it("fails when Hub has only moving tags", async () => {
    const get = hubGet({
      "https://hub.docker.com/v2/repositories/shotah/ai-gantry/tags?page_size=100": {
        next: null,
        results: [{ name: "latest" }, { name: "edge" }],
      },
    });
    await expect(resolveHubImage("shotah/ai-gantry:latest", get)).rejects.toThrow(/no semver tags/);
  });
});

describe("pullResolvedImage", () => {
  it("pulls the resolved semver and retags it onto the pin", async () => {
    const pull = vi.fn().mockResolvedValue(undefined);
    const tag = vi.fn().mockResolvedValue(undefined);
    await pullResolvedImage("shotah/ai-gantry:latest", {
      pull,
      tag,
      resolve: async () => "shotah/ai-gantry:1.1.112",
    });
    expect(pull).toHaveBeenCalledWith("shotah/ai-gantry:1.1.112");
    expect(tag).toHaveBeenCalledWith("shotah/ai-gantry:1.1.112", "shotah/ai-gantry:latest");
  });

  it("does not retag when the pin is already the image that was pulled", async () => {
    const pull = vi.fn().mockResolvedValue(undefined);
    const tag = vi.fn().mockResolvedValue(undefined);
    await pullResolvedImage("shotah/ai-gantry:1.1.112", {
      pull,
      tag,
      resolve: async (image) => image,
    });
    expect(pull).toHaveBeenCalledWith("shotah/ai-gantry:1.1.112");
    expect(tag).not.toHaveBeenCalled();
  });
});
