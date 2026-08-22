import { describe, expect, it } from "vitest";
import { waitUntilDoctorSettled } from "./run";
import type { DoctorReport } from "./types";

function report(processOk: boolean, extra: DoctorReport["checks"] = []): DoctorReport {
  return {
    slug: "kit",
    ok: processOk && extra.every((c) => c.ok),
    checks: [{ id: "process", ok: processOk, detail: processOk ? "running" : "exited" }, ...extra],
  };
}

describe("waitUntilDoctorSettled", () => {
  it("returns doctor ok once the process is up", async () => {
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 1_000,
      intervalMs: 1,
      doctor: async () => report(true),
      sleep: async () => undefined,
    });
    expect(result).toEqual({ ok: true, detail: "doctor ok" });
  });

  it("is honest when process is up but MCP is missing", async () => {
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 1_000,
      intervalMs: 1,
      doctor: async () => report(true, [{ id: "mcp-listed", ok: false, detail: "zero servers" }]),
      sleep: async () => undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("zero servers");
  });

  it("fails if the process never comes up", async () => {
    let t = 0;
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 10,
      intervalMs: 5,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      doctor: async () => report(false),
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/timed out/);
  });
});
