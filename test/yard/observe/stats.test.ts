import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { card } from "../card";

vi.mock("@/lib/yard/crane/inventory", () => ({
  getGantry: vi.fn(),
}));

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    containerStatsOnce: vi.fn(),
    containerLogsBuffer: vi.fn(),
  };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [{ name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." }],
}));

import { getGantry } from "@/lib/yard/crane/inventory";
import { containerLogsBuffer, containerStatsOnce } from "@/lib/yard/host/docker";
import {
  clearObserveRings,
  kickYardSamples,
  kickYardSpend,
  peekHost,
  peekTurns,
  peekYardSpend,
  sampleHost,
  sampleMcp,
  sampleTurns,
  sampleUptime,
} from "@/lib/yard/observe/stats";
import { closeYardDb } from "@/lib/yard/door/store";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(getGantry).mockReset();
  vi.mocked(containerStatsOnce).mockReset();
  vi.mocked(containerLogsBuffer).mockReset();
  closeYardDb();
  clearObserveRings();
  const root = mkdtempSync(join(tmpdir(), "gantree-stats-"));
  dirs.push(root);
  process.env.GANTREE_DB = join(root, "gantree.db");
});

afterEach(() => {
  closeYardDb();
  clearObserveRings();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

const statsRaw = {
  cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 1000, online_cpus: 2 },
  precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
  memory_stats: { usage: 50_000_000, limit: 100_000_000 },
} as never;

describe("sampleHost", () => {
  it("keeps an empty ring when the crane is down", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "down", containerId: null, state: "exited" }));
    expect(await sampleHost("down")).toEqual([]);
  });

  it("records cpu/mem and ignores a stats failure", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "host-ok" }));
    vi.mocked(containerStatsOnce).mockResolvedValue(statsRaw);
    const rows = await sampleHost("host-ok");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cpuPercent).toBeCloseTo(40);
    expect(rows[0]?.memBytes).toBe(50_000_000);

    vi.mocked(containerStatsOnce).mockRejectedValue(new Error("busy"));
    const kept = await sampleHost("host-ok");
    expect(kept).toHaveLength(1);
  });
});

describe("sampleTurns", () => {
  it("returns the existing ring without a container", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "no-cid", containerId: null }));
    expect(await sampleTurns("no-cid")).toEqual([]);
  });

  it("ingests turn perf lines once and skips junk", async () => {
    const line =
      '{"time":"2026-08-22T18:00:00.000Z","msg":"turn perf","prompt_est_tokens":10,"gen_est_tokens":2,"iterations":1}\n';
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "turns-ok" }));
    vi.mocked(containerLogsBuffer).mockResolvedValue(
      Buffer.from(`${line}{"time":"2026-08-22T18:00:00Z","msg":"tools_published"}\nnot-json\n{"msg":"turn perf"}\n`),
    );
    const first = await sampleTurns("turns-ok");
    expect(first).toHaveLength(1);
    expect(first[0]?.estTokens).toBe(12);

    vi.mocked(containerLogsBuffer).mockResolvedValue(Buffer.from(line));
    expect(await sampleTurns("turns-ok")).toHaveLength(1);

    vi.mocked(containerLogsBuffer).mockRejectedValue(new Error("dead"));
    expect(await sampleTurns("turns-ok")).toHaveLength(1);
  });
});

describe("sampleMcp and sampleUptime", () => {
  it("returns empty rings when the slug is unknown", async () => {
    vi.mocked(getGantry).mockResolvedValue(null);
    expect(await sampleMcp("ghost")).toEqual([]);
    expect(await sampleUptime("ghost")).toEqual([]);
  });

  it("samples published/skipped and running uptime", async () => {
    vi.mocked(getGantry).mockResolvedValue(
      card({
        slug: "up",
        mcpManifest: null,
        startedAt: new Date(Date.now() - 5_000).toISOString(),
        restartCount: 3,
      }),
    );
    const mcp = await sampleMcp("up");
    expect(mcp[0]).toMatchObject({ published: 0, skipped: 0 });
    const up = await sampleUptime("up");
    expect(up[0]?.restartCount).toBe(3);
    expect(up[0]?.uptimeSeconds).toBeGreaterThan(0);

    vi.mocked(getGantry).mockResolvedValue(card({ slug: "stopped", state: "exited", startedAt: "nope" }));
    const down = await sampleUptime("stopped");
    expect(down[0]?.uptimeSeconds).toBeNull();
  });
});

describe("peek and kick", () => {
  it("kicks host samples without blocking and does not leak leftover rings", async () => {
    vi.mocked(getGantry).mockImplementation(async (slug: string) => card({ slug }));
    vi.mocked(containerStatsOnce).mockResolvedValue(statsRaw);
    await sampleHost("extra");
    const peeked = kickYardSamples(["kick-a"]);
    expect(peeked.extra).toBeUndefined();
    expect(peeked["kick-a"]).toEqual([]);
    expect(peekHost("kick-a")).toEqual([]);
    await vi.waitFor(() => expect(peekHost("kick-a").length).toBeGreaterThan(0));
  });

  it("kicks turn spend and peeks a window", async () => {
    vi.mocked(getGantry).mockResolvedValue(card({ slug: "spend-a" }));
    vi.mocked(containerLogsBuffer).mockResolvedValue(
      Buffer.from(
        '{"time":"2026-08-22T18:00:00.000Z","msg":"turn perf","prompt_est_tokens":8,"gen_est_tokens":2}\n',
      ),
    );
    await sampleTurns("spend-a");
    expect(peekTurns("spend-a")).toHaveLength(1);
    const spend = kickYardSpend(["spend-a"]);
    expect(spend.estTokens).toBe(10);
    expect(peekYardSpend(["spend-a"], Date.now() + 1_000).turns).toBe(0);
  });
});
