import { getGantry } from "../crane/inventory";
import { containerLogsBuffer, containerStatsOnce, cpuMemFromStats } from "../host/docker";
import { dirBytes } from "../host/disk";
import { decodeDockerLogs, parseLogText, turnFromLog } from "../host/logs";
import { mcpSnapshot } from "../tools/mcp";
import type { McpSample, StatSample, TurnSample, UptimeSample, YardSpend } from "../types";
import { persistHost, persistMcp, persistTurn, persistUptime, recallSamples } from "./memory";
import { combineSpend, filterSamples, rollupTurns } from "./spend";
import { clearMachineRing, rememberedCraneNames, sampleMachine } from "./machine";

const HOST_MAX = 720;
/** Docker log tail. Regular sampling only needs new lines; this is the restart backfill. */
const TURN_TAIL = 5000;
const TURN_MAX = 10_000;
const MCP_MAX = 200;
const SPEND_SAMPLE_MS = 15_000;
/** `du` is slower than docker stats — once per five minutes per crane. */
const DISK_SAMPLE_MS = 5 * 60 * 1000;
const hostRing = new Map<string, StatSample[]>();
const turnRing = new Map<string, TurnSample[]>();
const mcpRing = new Map<string, McpSample[]>();
const uptimeRing = new Map<string, UptimeSample[]>();
const hydrated = new Set<string>();
const diskAt = new Map<string, number>();
const diskVal = new Map<string, number | null>();
let spendTimer: ReturnType<typeof setInterval> | null = null;

function inObserveTests(): boolean {
  return Boolean(process.env.VITEST);
}

/** Keep scraping turn perf after the board tab closes, so sqlite does not stall. */
export function ensureSpendSampler(): void {
  if (spendTimer || inObserveTests()) {
    return;
  }
  spendTimer = setInterval(() => {
    void tickSpendSampler();
  }, SPEND_SAMPLE_MS);
  spendTimer.unref?.();
}

async function tickSpendSampler(): Promise<void> {
  const slugs = new Set([...hydrated, ...turnRing.keys()]);
  await Promise.all([...slugs].map((slug) => sampleTurns(slug).catch(() => [])));
  await sampleMachine(rememberedCraneNames()).catch(() => null);
}

/** Test helper: true when the keep-alive turn scraper is armed. */
export function spendSamplerArmed(): boolean {
  return spendTimer != null;
}

function push<T>(map: Map<string, T[]>, slug: string, sample: T, max: number): T[] {
  const cur = map.get(slug) ?? [];
  cur.push(sample);
  while (cur.length > max) {
    cur.shift();
  }
  map.set(slug, cur);
  return cur;
}

function ensureHydrated(slug: string): void {
  if (hydrated.has(slug)) {
    return;
  }
  hydrated.add(slug);
  const mem = recallSamples(slug, { host: HOST_MAX, turns: TURN_MAX, mcp: MCP_MAX, uptime: HOST_MAX });
  if (!hostRing.has(slug) && mem.host.length) {
    hostRing.set(slug, mem.host);
    const last = [...mem.host].reverse().find((s) => s.diskBytes != null);
    if (last) {
      diskVal.set(slug, last.diskBytes ?? null);
      diskAt.set(slug, last.at);
    }
  }
  if (!turnRing.has(slug) && mem.turns.length) {
    turnRing.set(slug, mem.turns);
  }
  if (!mcpRing.has(slug) && mem.mcp.length) {
    mcpRing.set(slug, mem.mcp);
  }
  if (!uptimeRing.has(slug) && mem.uptime.length) {
    uptimeRing.set(slug, mem.uptime);
  }
}

/** Test helper: drop in-memory rings as if the process bounced. Sqlite stays. */
export function clearObserveRings(): void {
  hostRing.clear();
  turnRing.clear();
  mcpRing.clear();
  uptimeRing.clear();
  hydrated.clear();
  diskAt.clear();
  diskVal.clear();
  clearMachineRing();
}

export async function sampleHost(slug: string): Promise<StatSample[]> {
  ensureHydrated(slug);
  const g = await getGantry(slug);
  if (!g?.containerId || g.state !== "running") {
    return hostRing.get(slug) ?? [];
  }
  try {
    const raw = (await containerStatsOnce(g.containerId)) as Parameters<typeof cpuMemFromStats>[0];
    const io = cpuMemFromStats(raw);
    const diskBytes = await maybeDiskBytes(slug, g.dataDir);
    const sample = { at: Date.now(), ...io, diskBytes };
    push(hostRing, slug, sample, HOST_MAX);
    persistHost(slug, sample);
  } catch {
    /* keep last ring */
  }
  return hostRing.get(slug) ?? [];
}

async function maybeDiskBytes(slug: string, dataDir: string | null): Promise<number | null> {
  const cached = diskVal.get(slug) ?? null;
  if (!dataDir) {
    return cached;
  }
  const last = diskAt.get(slug) ?? 0;
  if (diskVal.has(slug) && Date.now() - last < DISK_SAMPLE_MS) {
    return cached;
  }
  const n = await dirBytes(dataDir);
  diskAt.set(slug, Date.now());
  diskVal.set(slug, n ?? cached);
  return diskVal.get(slug) ?? null;
}

export async function sampleTurns(slug: string): Promise<TurnSample[]> {
  ensureSpendSampler();
  ensureHydrated(slug);
  const g = await getGantry(slug);
  if (!g?.containerId) {
    return turnRing.get(slug) ?? [];
  }
  try {
    const buf = await containerLogsBuffer(g.containerId, TURN_TAIL);
    const lines = parseLogText(decodeDockerLogs(buf));
    const existing = new Set((turnRing.get(slug) ?? []).map((t) => t.key));
    for (const line of lines) {
      const t = turnFromLog(line);
      if (!t) {
        continue;
      }
      const at = line.ts ? Date.parse(line.ts) : NaN;
      if (!Number.isFinite(at)) {
        continue;
      }
      const key = line.raw;
      if (existing.has(key)) {
        continue;
      }
      existing.add(key);
      const sample = { at, key, ...t };
      push(turnRing, slug, sample, TURN_MAX);
      persistTurn(slug, sample);
    }
  } catch {
    /* keep last ring */
  }
  return turnRing.get(slug) ?? [];
}

export async function sampleMcp(slug: string): Promise<McpSample[]> {
  ensureHydrated(slug);
  const g = await getGantry(slug);
  if (!g) {
    return mcpRing.get(slug) ?? [];
  }
  const snap = mcpSnapshot(g);
  const sample = { at: Date.now(), published: snap.published, skipped: snap.skipped };
  push(mcpRing, slug, sample, MCP_MAX);
  persistMcp(slug, sample);
  return mcpRing.get(slug) ?? [];
}

export async function sampleUptime(slug: string): Promise<UptimeSample[]> {
  ensureHydrated(slug);
  const g = await getGantry(slug);
  if (!g) {
    return uptimeRing.get(slug) ?? [];
  }
  let uptimeSeconds: number | null = null;
  if (g.state === "running" && g.startedAt) {
    const started = Date.parse(g.startedAt);
    if (Number.isFinite(started)) {
      uptimeSeconds = Math.max(0, (Date.now() - started) / 1000);
    }
  }
  const sample = { at: Date.now(), uptimeSeconds, restartCount: g.restartCount };
  push(uptimeRing, slug, sample, HOST_MAX);
  persistUptime(slug, sample);
  return uptimeRing.get(slug) ?? [];
}

export function peekHost(slug: string): StatSample[] {
  ensureHydrated(slug);
  return hostRing.get(slug) ?? [];
}

export function peekTurns(slug: string): TurnSample[] {
  ensureHydrated(slug);
  return turnRing.get(slug) ?? [];
}

export function peekYardSpend(slugs: string[], since: number | null = null): YardSpend {
  return combineSpend(slugs.map((slug) => rollupTurns(slug, filterSamples(peekTurns(slug), since))));
}

/** Kick host samples for the board without blocking the list response. */
export function kickYardSamples(slugs: string[]): Record<string, StatSample[]> {
  for (const slug of slugs) {
    void sampleHost(slug).catch(() => []);
  }
  const out: Record<string, StatSample[]> = {};
  for (const slug of slugs) {
    out[slug] = peekHost(slug);
  }
  return out;
}

/** Kick turn-perf samples for the board without blocking the list response. */
export function kickYardSpend(slugs: string[], since: number | null = null): YardSpend {
  for (const slug of slugs) {
    void sampleTurns(slug).catch(() => []);
  }
  return peekYardSpend(slugs, since);
}
