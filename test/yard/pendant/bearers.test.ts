import { describe, expect, it } from "vitest";
import {
  dropCraneBearer,
  formatCraneBearers,
  googleRedirectForOrigin,
  mailboxUrlForSlug,
  mergeCraneBearer,
  mintBearer,
  mintSecret,
  normalizePendantOrigin,
  parseCraneBearers,
} from "@/lib/yard/pendant/bearers";

describe("parseCraneBearers / formatCraneBearers", () => {
  it("reads slug:token, JSON, and merges without dropping other slugs", () => {
    expect(parseCraneBearers("kit:aaa,tryout:bbb")).toEqual({ kit: "aaa", tryout: "bbb" });
    expect(parseCraneBearers('{"kit":"aaa","tryout":"bbb"}')).toEqual({ kit: "aaa", tryout: "bbb" });
    expect(formatCraneBearers({ tryout: "bbb", kit: "aaa" })).toBe("kit:aaa,tryout:bbb");
    expect(formatCraneBearers(mergeCraneBearer({ kit: "old", ada: "keep" }, "kit", "new"))).toBe(
      "ada:keep,kit:new",
    );
    expect(dropCraneBearer({ kit: "a", ada: "b" }, "kit")).toEqual({ ada: "b" });
    expect(parseCraneBearers("1bad:x no-colon kit:")).toEqual({});
  });
});

describe("mintBearer", () => {
  it("returns unique base64url secrets", () => {
    const a = mintBearer();
    const b = mintSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(b);
  });
});

describe("normalizePendantOrigin", () => {
  it("normalizes host, https, and wss to an https origin", () => {
    expect(normalizePendantOrigin("gantry-pendant.example.workers.dev")).toBe(
      "https://gantry-pendant.example.workers.dev",
    );
    expect(normalizePendantOrigin("https://gantry-pendant.example.workers.dev/")).toBe(
      "https://gantry-pendant.example.workers.dev",
    );
    expect(normalizePendantOrigin("wss://gantry-pendant.example.workers.dev/ws/kit")).toBe(
      "https://gantry-pendant.example.workers.dev",
    );
    expect(mailboxUrlForSlug("https://gantry-pendant.example.workers.dev", "kit")).toBe(
      "wss://gantry-pendant.example.workers.dev/ws/kit",
    );
    expect(googleRedirectForOrigin("https://gantry-pendant.example.workers.dev")).toBe(
      "https://gantry-pendant.example.workers.dev/api/auth/callback/google",
    );
    expect(normalizePendantOrigin("nota url")).toBeNull();
    expect(mailboxUrlForSlug("https://x.example", "1bad")).toBeNull();
  });
});
