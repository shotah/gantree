import { beforeEach, describe, expect, it, vi } from "vitest";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/crane/doctor", () => ({
  doctor: vi.fn(),
}));

vi.mock("@/lib/yard/crane/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/crane/build")>();
  return { ...actual, createOrReplaceContainer: vi.fn() };
});

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return { ...actual, docker: vi.fn(), pullImage: vi.fn() };
});

vi.mock("@/lib/yard/host/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/files")>();
  return { ...actual, backupFiles: vi.fn() };
});

vi.mock("@/lib/yard/host/envfile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/envfile")>();
  return { ...actual, loadEnvFile: vi.fn(() => ({ CHANNEL: "telegram" })) };
});

vi.mock("@/lib/yard/tools/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/tools/auth")>();
  return { ...actual, toolsFetch: vi.fn() };
});

import { createOrReplaceContainer } from "@/lib/yard/crane/build";
import { doctor } from "@/lib/yard/crane/doctor";
import { getGantry } from "@/lib/yard/crane/inventory";
import { run, waitUntilDoctorSettled } from "@/lib/yard/crane/run";
import { docker, pullImage } from "@/lib/yard/host/docker";
import { backupFiles } from "@/lib/yard/host/files";
import { toolsFetch } from "@/lib/yard/tools/auth";
import { DEFAULT_IMAGE, type DoctorReport } from "@/lib/yard/types";

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(doctor).mockReset();
  vi.mocked(createOrReplaceContainer).mockReset();
  vi.mocked(docker).mockReset();
  vi.mocked(pullImage).mockReset();
  vi.mocked(backupFiles).mockReset();
  vi.mocked(toolsFetch).mockReset();
  vi.mocked(toolsFetch).mockResolvedValue({ ok: true, detail: "tools-fetch: no download_url servers in manifest" });
});

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

  it("treats a still-starting health check as settling past timeout", async () => {
    let t = 0;
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 10,
      intervalMs: 5,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      doctor: async () =>
        report(true, [{ id: "docker-health", ok: false, detail: "health: starting" }]),
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/still settling/);
  });

  it("waits out a docker restart reload instead of treating it as up", async () => {
    let t = 0;
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 10,
      intervalMs: 5,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      doctor: async () => ({
        slug: "kit",
        ok: true,
        checks: [{ id: "process", ok: true, detail: "container ada is restarting (reload)" }],
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/still settling/);
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

  it("times out with a generic message when doctor never returns", async () => {
    let t = 0;
    const result = await waitUntilDoctorSettled("kit", {
      timeoutMs: 5,
      intervalMs: 5,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      doctor: async () => null,
    });
    expect(result).toEqual({ ok: false, detail: "timed out waiting for container to come up" });
  });
});

describe("run", () => {
  it("unknown slug and backup paths", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await run("nope", "start")).toMatchObject({ ok: false, detail: expect.stringMatching(/unknown/) });

    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(backupFiles).mockReturnValue("/tmp/backups/stamp");
    expect(await run("kit", "backup")).toEqual({
      ok: true,
      detail: "backed up gantry.db + SELF.md to /tmp/backups/stamp",
    });
    vi.mocked(backupFiles).mockReturnValue(null);
    expect(await run("kit", "backup")).toMatchObject({ ok: false });
  });

  it("recreates after a pin pull and waits for doctor", async () => {
    vi.mocked(getGantry).mockResolvedValue(
      card({ personaDir: "/p", dataDir: "/d", mcpManifest: "/m", envFile: "/e" }),
    );
    vi.mocked(pullImage).mockResolvedValue(undefined);
    vi.mocked(createOrReplaceContainer).mockResolvedValue({ id: "n", detail: "built crane kit" });
    vi.mocked(doctor).mockResolvedValue({
      slug: "kit",
      ok: true,
      checks: [{ id: "process", ok: true, detail: "running" }],
    });
    const pinned = await run("kit", "pin", DEFAULT_IMAGE);
    expect(pinned.ok).toBe(true);
    expect(pinned.detail).toMatch(/built crane/);
    expect(pullImage).toHaveBeenCalled();

    vi.mocked(pullImage).mockRejectedValue(new Error("hub down"));
    expect(await run("kit", "pin")).toMatchObject({ ok: false, detail: expect.stringMatching(/pull failed/) });

    vi.mocked(pullImage).mockResolvedValue(undefined);
    vi.mocked(createOrReplaceContainer).mockRejectedValue(new Error("create failed"));
    vi.mocked(getGantry).mockResolvedValue(
      card({ personaDir: "/p", dataDir: "/d", mcpManifest: "/m", envFile: "/e" }),
    );
    expect(await run("kit", "recreate")).toMatchObject({ ok: false, detail: "create failed" });

    vi.mocked(getGantry).mockResolvedValue(card({ personaDir: null }));
    expect(await run("kit", "recreate")).toMatchObject({ ok: false, detail: expect.stringMatching(/needs persona/) });
  });

  it("fetches MCP bins after recreate and reloads when install happens", async () => {
    const restart = vi.fn().mockResolvedValue(undefined);
    vi.mocked(docker).mockReturnValue({ getContainer: () => ({ restart }) } as never);
    vi.mocked(getGantry).mockResolvedValue(
      card({ personaDir: "/p", dataDir: "/d", mcpManifest: "/m", envFile: "/e" }),
    );
    vi.mocked(createOrReplaceContainer).mockResolvedValue({ id: "n", detail: "built crane kit" });
    vi.mocked(doctor).mockResolvedValue({
      slug: "kit",
      ok: true,
      checks: [{ id: "process", ok: true, detail: "running" }],
    });
    vi.mocked(toolsFetch).mockResolvedValue({
      ok: true,
      detail: "tools-fetch: done installed=2 skipped=0 total=2",
    });

    const out = await run("kit", "recreate");
    expect(out.ok).toBe(true);
    expect(out.detail).toMatch(/reloaded/);
    expect(restart).toHaveBeenCalledWith({ t: 5 });
  });

  it("starts and stops an attached container", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn().mockResolvedValue(undefined);
    vi.mocked(docker).mockReturnValue({ getContainer: () => ({ start, stop }) } as never);
    vi.mocked(getGantry).mockResolvedValue(card());
    vi.mocked(doctor).mockResolvedValue({
      slug: "kit",
      ok: true,
      checks: [{ id: "process", ok: true, detail: "running" }],
    });
    expect(await run("kit", "start")).toMatchObject({ ok: true, detail: expect.stringMatching(/^started/) });
    expect(await run("kit", "stop")).toEqual({ ok: true, detail: "stopped" });

    vi.mocked(getGantry).mockResolvedValue(card({ containerId: null }));
    expect(await run("kit", "start")).toMatchObject({ ok: false, detail: "no container attached" });

    vi.mocked(getGantry).mockResolvedValue(card());
    stop.mockRejectedValue("nope");
    expect(await run("kit", "stop")).toMatchObject({ ok: false, detail: "nope" });
  });
});
