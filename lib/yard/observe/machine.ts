import type { HostLive, HostProc, HostSample, HostSnapshot } from "../types";
import {
  containerStatsOnce,
  cpuMemFromStats,
  dockerHostInfo,
  listRunningWorkloads,
  workloadRole,
} from "../host/docker";
import { persistMachine, recallMachine } from "./memory";

const SPARK_MAX = 720;
const spark: HostSample[] = [];
let live: HostSnapshot | null = null;
let hydrated = false;
let lastCraneNames: string[] = [];

function ensureHydrated(): void {
  if (hydrated) {
    return;
  }
  hydrated = true;
  if (spark.length === 0) {
    spark.push(...recallMachine(SPARK_MAX));
  }
}

function toSample(snap: HostSnapshot): HostSample {
  return {
    at: snap.at,
    ncpu: snap.ncpu,
    memTotalBytes: snap.memTotalBytes,
    craneCpu: snap.craneCpu,
    consoleCpu: snap.consoleCpu,
    otherCpu: snap.otherCpu,
    craneMem: snap.craneMem,
    consoleMem: snap.consoleMem,
    otherMem: snap.otherMem,
  };
}

function pushSpark(row: HostSample): void {
  spark.push(row);
  while (spark.length > SPARK_MAX) {
    spark.shift();
  }
}

export function clearMachineRing(): void {
  spark.length = 0;
  live = null;
  hydrated = false;
  lastCraneNames = [];
}

export function peekMachine(): HostLive {
  ensureHydrated();
  return { live, spark: [...spark] };
}

export async function sampleMachine(craneNames: string[]): Promise<HostSnapshot | null> {
  ensureHydrated();
  lastCraneNames = craneNames;
  try {
    const [info, workloads] = await Promise.all([dockerHostInfo(), listRunningWorkloads()]);
    const procs: HostProc[] = await Promise.all(
      workloads.map(async (w) => {
        const role = workloadRole({ name: w.name, image: w.image, craneNames });
        try {
          const raw = (await containerStatsOnce(w.id)) as Parameters<typeof cpuMemFromStats>[0];
          const io = cpuMemFromStats(raw);
          return { name: w.name, role, cpuPercent: io.cpuPercent, memBytes: io.memBytes };
        } catch {
          return { name: w.name, role, cpuPercent: null, memBytes: null };
        }
      }),
    );
    const sum = (role: HostProc["role"], key: "cpuPercent" | "memBytes"): number =>
      procs.filter((p) => p.role === role).reduce((n, p) => n + (p[key] ?? 0), 0);
    const snap: HostSnapshot = {
      at: Date.now(),
      hostname: info.hostname,
      ncpu: info.ncpu,
      memTotalBytes: info.memTotalBytes,
      procs: procs.sort((a, b) => (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0)),
      craneCpu: sum("crane", "cpuPercent"),
      consoleCpu: sum("console", "cpuPercent"),
      otherCpu: sum("other", "cpuPercent"),
      craneMem: sum("crane", "memBytes"),
      consoleMem: sum("console", "memBytes"),
      otherMem: sum("other", "memBytes"),
    };
    live = snap;
    const row = toSample(snap);
    pushSpark(row);
    persistMachine(row);
    return snap;
  } catch {
    return live;
  }
}

export function kickMachine(craneNames: string[]): HostLive {
  lastCraneNames = craneNames;
  void sampleMachine(craneNames).catch(() => null);
  return peekMachine();
}

export function rememberedCraneNames(): string[] {
  return lastCraneNames;
}
