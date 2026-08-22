import { containerLogsBuffer, containerStatsOnce, cpuMemFromStats } from "./docker";
import { getGantry } from "./inventory";
import { decodeDockerLogs, parseLogText, turnFromLog } from "./logs";
import { mcpSnapshot } from "./mcp";
import type { McpSample, StatSample, TurnSample, UptimeSample } from "./types";

const HOST_MAX = 720;
const hostRing = new Map<string, StatSample[]>();
const turnRing = new Map<string, TurnSample[]>();
const mcpRing = new Map<string, McpSample[]>();
const uptimeRing = new Map<string, UptimeSample[]>();

function push<T>(map: Map<string, T[]>, slug: string, sample: T, max: number): T[] {
  const cur = map.get(slug) ?? [];
  cur.push(sample);
  while (cur.length > max) {
    cur.shift();
  }
  map.set(slug, cur);
  return cur;
}

export async function sampleHost(slug: string): Promise<StatSample[]> {
  const g = await getGantry(slug);
  if (!g?.containerId || g.state !== "running") {
    return hostRing.get(slug) ?? [];
  }
  try {
    const raw = (await containerStatsOnce(g.containerId)) as Parameters<typeof cpuMemFromStats>[0];
    const { cpuPercent, memBytes, memLimitBytes } = cpuMemFromStats(raw);
    push(hostRing, slug, { at: Date.now(), cpuPercent, memBytes, memLimitBytes }, HOST_MAX);
  } catch {
    /* keep last ring */
  }
  return hostRing.get(slug) ?? [];
}

export async function sampleTurns(slug: string): Promise<TurnSample[]> {
  const g = await getGantry(slug);
  if (!g?.containerId) {
    return turnRing.get(slug) ?? [];
  }
  try {
    const buf = await containerLogsBuffer(g.containerId, 80);
    const lines = parseLogText(decodeDockerLogs(buf));
    const existing = new Set((turnRing.get(slug) ?? []).map((t) => t.at));
    for (const line of lines) {
      const t = turnFromLog(line);
      if (!t) {
        continue;
      }
      const at = line.ts ? Date.parse(line.ts) : Date.now();
      if (!Number.isFinite(at) || existing.has(at)) {
        continue;
      }
      existing.add(at);
      push(turnRing, slug, { at, ...t }, 200);
    }
  } catch {
    /* keep last ring */
  }
  return turnRing.get(slug) ?? [];
}

export async function sampleMcp(slug: string): Promise<McpSample[]> {
  const g = await getGantry(slug);
  if (!g) {
    return mcpRing.get(slug) ?? [];
  }
  const snap = mcpSnapshot(g);
  push(mcpRing, slug, { at: Date.now(), published: snap.published, skipped: snap.skipped }, 200);
  return mcpRing.get(slug) ?? [];
}

export async function sampleUptime(slug: string): Promise<UptimeSample[]> {
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
  push(uptimeRing, slug, { at: Date.now(), uptimeSeconds, restartCount: g.restartCount }, HOST_MAX);
  return uptimeRing.get(slug) ?? [];
}

export function peekHost(slug: string): StatSample[] {
  return hostRing.get(slug) ?? [];
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
  for (const [slug, samples] of hostRing) {
    if (!(slug in out)) {
      out[slug] = samples;
    }
  }
  return out;
}
