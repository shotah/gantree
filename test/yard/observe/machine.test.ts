import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    dockerHostInfo: vi.fn(),
    listRunningWorkloads: vi.fn(),
    containerStatsOnce: vi.fn(),
  };
});

import { dockerHostInfo, listRunningWorkloads, containerStatsOnce } from "@/lib/yard/host/docker";
import { closeYardDb } from "@/lib/yard/door/store";
import { clearMachineRing, peekMachine, sampleMachine } from "@/lib/yard/observe/machine";

const dirs: string[] = [];

beforeEach(() => {
  closeYardDb();
  clearMachineRing();
  const root = mkdtempSync(join(tmpdir(), "gantree-machine-"));
  dirs.push(root);
  process.env.GANTREE_DB = join(root, "gantree.db");
  vi.mocked(dockerHostInfo).mockResolvedValue({ hostname: "paddleboy", ncpu: 4, memTotalBytes: 8_000_000_000 });
  vi.mocked(listRunningWorkloads).mockResolvedValue([
    { id: "a", name: "gantry-tim", image: "shotah/ai-gantry:latest" },
    { id: "b", name: "gantree-gantree-1", image: "shotah/gantree:latest" },
    { id: "c", name: "gantree-cloudflared-1", image: "cloudflare/cloudflared:latest" },
  ]);
  vi.mocked(containerStatsOnce).mockImplementation(async (id: string) => {
    const cpu = id === "a" ? 40 : id === "b" ? 10 : 5;
    return {
      cpu_stats: { cpu_usage: { total_usage: cpu + 10 }, system_cpu_usage: 200, online_cpus: 4 },
      precpu_stats: { cpu_usage: { total_usage: 10 }, system_cpu_usage: 100 },
      memory_stats: { usage: cpu * 1_000_000, limit: 8_000_000_000 },
      networks: {
        eth0: {
          rx_bytes: id === "a" ? 1_200_000 : id === "b" ? 80_000 : 400_000,
          tx_bytes: id === "a" ? 300_000 : id === "b" ? 20_000 : 90_000,
        },
      },
    } as never;
  });
});

afterEach(() => {
  closeYardDb();
  clearMachineRing();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("sampleMachine", () => {
  it("rolls agents, dashboard, and other against host ncpu", async () => {
    const snap = await sampleMachine(["gantry-tim"]);
    expect(snap?.hostname).toBe("paddleboy");
    expect(snap?.ncpu).toBe(4);
    expect(snap?.procs.map((p) => p.role)).toEqual(["crane", "console", "other"]);
    expect(snap?.craneCpu).toBeGreaterThan(0);
    expect(snap?.consoleCpu).toBeGreaterThan(0);
    expect(snap?.otherCpu).toBeGreaterThan(0);
    expect(snap?.craneRx).toBe(1_200_000);
    expect(snap?.consoleTx).toBe(20_000);
    expect(snap?.otherRx).toBe(400_000);
    expect(peekMachine().live?.hostname).toBe("paddleboy");
    expect(peekMachine().spark.length).toBe(1);

    clearMachineRing();
    const recalled = peekMachine();
    expect(recalled.live).toBeNull();
    expect(recalled.spark).toHaveLength(1);
    expect(recalled.spark[0]?.craneCpu).toBeGreaterThan(0);
    expect(recalled.spark[0]?.craneRx).toBe(1_200_000);
  });
});
