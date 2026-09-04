import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeYardDb } from "@/lib/yard/door/store";
import { resetYardDockerCache, listYard } from "@/lib/yard/crane/inventory";
import {
  containerLogsBuffer,
  containerStatsOnce,
  cpuMemFromStats,
  dockerErrorMessage,
  dockerHostInfo,
  dockerSocketCandidates,
  dockerSocketPath,
  execStatus,
  findConsoleWorkload,
  inspectByName,
  listGantryContainers,
  listRunningWorkloads,
  resetDockerClient,
} from "@/lib/yard/host/docker";
import { resetShotModeWarnings, shotDockerEnabled } from "@/lib/yard/host/shotMode";
import { decode } from "jpeg-js";
import { recallMachine, recallSamples } from "@/lib/yard/observe/memory";
import { clearObserveRings } from "@/lib/yard/observe/stats";
import { listOperators } from "@/lib/yard/door/operators";
import { findAvatar } from "@/lib/yard/host/avatar";
import { SHOT_CRANES, SHOT_OPERATORS } from "@/lib/yard/shot/catalog";
import { loadBoardSnapshot } from "@/lib/yard/host/boards";
import { parseSeedArgs, seedYard } from "@/lib/yard/shot/seed";
import { tileJpeg } from "@/lib/yard/shot/tileJpeg";

const dirs: string[] = [];

beforeEach(() => {
  closeYardDb();
  resetYardDockerCache();
  resetDockerClient();
  resetShotModeWarnings();
  clearObserveRings();
  const root = mkdtempSync(join(tmpdir(), "gantree-shot-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_DB = join(root, "gantree.db");
  process.env.HOST = "127.0.0.1";
  delete process.env.GANTREE_SHOT;
  delete process.env.DOCKER_SOCKET;
  delete process.env.DOCKER_HOST;
  delete process.env.XDG_RUNTIME_DIR;
});

afterEach(() => {
  closeYardDb();
  resetYardDockerCache();
  resetDockerClient();
  resetShotModeWarnings();
  clearObserveRings();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
  delete process.env.GANTREE_DB;
  delete process.env.HOST;
  delete process.env.GANTREE_SHOT;
  delete process.env.DOCKER_SOCKET;
  delete process.env.DOCKER_HOST;
  delete process.env.XDG_RUNTIME_DIR;
});

describe("parseSeedArgs", () => {
  it("reads help", () => {
    expect(parseSeedArgs(["--help"])).toEqual({ help: true });
  });

  it("rejects junk", () => {
    expect(() => parseSeedArgs(["--force"])).toThrow(/unknown arg/);
  });
});

describe("tileJpeg", () => {
  it("encodes a real JPEG the avatar gate will take", () => {
    const jpeg = tileJpeg("Ada");
    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);
    const decoded = decode(jpeg, { useTArray: true });
    expect(decoded.width).toBe(256);
    expect(decoded.height).toBe(256);
  });
});

describe("dockerSocketPath", () => {
  it("honors an explicit unix DOCKER_HOST", () => {
    process.env.DOCKER_HOST = "unix:///tmp/gantree-fake.sock";
    expect(dockerSocketPath()).toBe("/tmp/gantree-fake.sock");
  });

  it("lists the rootless Arch/SteamOS sockets after the system path", () => {
    const runtime = join(dirs[0] ?? tmpdir(), "run");
    process.env.XDG_RUNTIME_DIR = runtime;
    expect(dockerSocketCandidates()).toEqual([
      "/var/run/docker.sock",
      `${runtime}/docker.sock`,
      `${runtime}/podman/podman.sock`,
    ]);
  });
});

describe("dockerErrorMessage", () => {
  it("points Arch/SteamOS at the rootless socket or shot mode", () => {
    expect(dockerErrorMessage(Object.assign(new Error("ENOENT"), { message: "connect ENOENT /var/run/docker.sock" }))).toMatch(
      /GANTREE_SHOT/,
    );
  });
});

describe("seedYard", () => {
  it("fills operators, named cranes, avatars, and observe series", async () => {
    const report = seedYard();
    expect(report.cranes).toEqual(SHOT_CRANES.map((c) => c.slug));
    expect(listOperators().map((o) => o.name)).toEqual(SHOT_OPERATORS.map((o) => o.name));
    const bob = listOperators().find((o) => o.name === "bob");
    expect(bob?.displayName).toBe("Bob Kit");
    expect(bob?.email).toBe("bob@yard.local");
    expect(bob?.channels.telegram).toEqual(["41001001"]);
    expect(bob?.avatarRev).toBeGreaterThan(0);

    const kitPersona = join(report.root, "gantries", "kit", "persona");
    expect(findAvatar(kitPersona)?.name).toBe("avatar.jpg");

    process.env.GANTREE_SHOT = "1";
    resetYardDockerCache();
    const listed = await listGantryContainers();
    expect(listed).toHaveLength(5);
    expect(listed.every((c) => c.state === "running")).toBe(true);

    const yard = await listYard();
    expect(yard.dockerError).toBeNull();
    expect(yard.gantries).toHaveLength(5);
    const ada = yard.gantries.find((g) => g.slug === "ada");
    expect(ada?.state).toBe("running");
    expect(ada?.model).toBe("gemini-3.6-flash");
    expect(ada?.channel).toBe("telegram");
    expect(ada?.avatarRev).toBeGreaterThan(0);

    const inspected = await inspectByName("ada");
    expect(inspected?.info.Id).toBe("shot-ada");
    expect(inspected?.info.Config.Env?.some((e) => e.startsWith("LLM_MODEL="))).toBe(true);
    const stats = await containerStatsOnce("shot-ada");
    const cpu = cpuMemFromStats(stats as Parameters<typeof cpuMemFromStats>[0]);
    expect(cpu.cpuPercent).toBeGreaterThan(5);
    expect(cpu.cpuPercent).toBeLessThan(80);
    expect(cpu.memBytes).toBeGreaterThan(1_000_000);
    expect(await execStatus("shot-ada")).toMatch(/"alive":true/);
    expect((await dockerHostInfo()).ncpu).toBeGreaterThan(0);
    expect((await containerLogsBuffer("shot-ada", 20)).includes("turn perf")).toBe(true);
    expect((await findConsoleWorkload())?.id).toBe("shot-console");
    expect((await listRunningWorkloads()).some((w) => w.name === "gantree")).toBe(true);
    expect(await inspectByName("nope")).toBeNull();

    const board = loadBoardSnapshot(join(report.root, "boards"));
    expect(board.empty).toBe(false);
    expect(board.roster.map((r) => r.author)).toEqual(["kit", "ada", "jules"]);
    expect(board.open.map((c) => c.id)).toEqual(["c_shot_steps", "c_shot_sleep"]);
    expect(board.open[0]?.title).toBe("100k steps");
    expect(board.open[0]?.scores).toEqual([
      { author: "kit", value: 32880 },
      { author: "ada", value: 22830 },
    ]);
    expect(board.closed.map((c) => c.id)).toEqual(["c_shot_old"]);
    expect(board.closed[0]?.winner).toBe("kit");
    expect(board.closed[0]?.scores).toEqual([
      { author: "kit", value: 11200 },
      { author: "ada", value: 9800 },
    ]);
    expect(board.pins).toEqual([
      {
        id: "n_shot_pr",
        author: "kit",
        body: "Bob beat his 5k PR!",
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    ]);

    const turns = recallSamples("ada", { host: 50, turns: 200, mcp: 20, uptime: 20 });
    expect(turns.turns.length).toBeGreaterThan(40);
    expect(turns.host.length).toBeGreaterThan(40);
    expect(turns.turns.some((t) => t.userId === "41001003")).toBe(true);
    expect(recallMachine(20).length).toBeGreaterThan(10);
  }, 20_000);

  it("does not paint when the bind is open", () => {
    process.env.GANTREE_SHOT = "1";
    process.env.HOST = "0.0.0.0";
    resetShotModeWarnings();
    expect(shotDockerEnabled()).toBe(false);
  });
});
