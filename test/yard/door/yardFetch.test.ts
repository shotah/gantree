/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("yardFetch", () => {
  it("sends a 401 with setup:true to /setup, and any other 401 to /login", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "setup required", setup: true }), { status: 401 })),
    );
    await yardFetch("/api/gantries");
    expect(replace).toHaveBeenCalledWith("/setup");

    replace.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );
    await yardFetch("/api/gantries");
    expect(replace).toHaveBeenCalledWith("/login");

    replace.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const ok = await yardFetch("/api/gantries");
    expect(ok.status).toBe(200);
    expect(replace).not.toHaveBeenCalled();
  });
});
