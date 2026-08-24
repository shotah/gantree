import type { HostSample, TurnSample } from "../types";
import { SOURCE_ORDER, spendSource, type SpendBucket, type SpendRateBucket } from "./windows";

export type TokenChartPoint = {
  at: number;
  prompt: number;
  gen: number;
  tokens: number;
  turns: number;
};

export type SourceChartPoint = { at: number } & Record<(typeof SOURCE_ORDER)[number], number>;

const HOST_NET_KEYS = ["craneRx", "craneTx", "consoleRx", "consoleTx", "otherRx", "otherTx"] as const;

export type HostNetRate = { at: number } & Record<(typeof HOST_NET_KEYS)[number], number>;

export function filterSamples<T extends { at: number }>(rows: T[], since: number | null, now?: number): T[] {
  return rows.filter((r) => (since == null || r.at >= since) && (now == null || r.at <= now));
}

/** Keep first + last. Recharts SVG cost scales with point count, not with operator intent. */
export function thinChartPoints<T>(rows: T[], max = 240): T[] {
  if (rows.length <= max) {
    return rows;
  }
  const last = rows.length - 1;
  const out: T[] = [];
  let prev = -1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * last) / (max - 1));
    if (idx === prev) {
      continue;
    }
    out.push(rows[idx]);
    prev = idx;
  }
  return out;
}

export function alignBucket(at: number, bucket: SpendRateBucket): number {
  const d = new Date(at);
  if (bucket === "hour") {
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  if (bucket === "day") {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const step = bucket === "6h" ? 6 : 12;
  d.setHours(Math.floor(d.getHours() / step) * step, 0, 0, 0);
  return d.getTime();
}

function nextBucket(at: number, bucket: SpendRateBucket): number {
  const d = new Date(at);
  if (bucket === "hour") {
    d.setHours(d.getHours() + 1);
  } else if (bucket === "day") {
    d.setDate(d.getDate() + 1);
  } else {
    d.setHours(d.getHours() + (bucket === "6h" ? 6 : 12));
  }
  return d.getTime();
}

export function turnHasNative(t: TurnSample): boolean {
  return t.promptTokens != null || t.completionTokens != null || t.totalTokens != null;
}

/** Native Completer usage when slog had it; chars/4 estimate otherwise. */
export function turnCost(t: TurnSample): { prompt: number; gen: number; tokens: number; native: boolean } {
  if (turnHasNative(t)) {
    const prompt = t.promptTokens ?? 0;
    const gen = t.completionTokens ?? 0;
    return { prompt, gen, tokens: t.totalTokens ?? prompt + gen, native: true };
  }
  const prompt = t.promptEstTokens ?? 0;
  const gen = t.genEstTokens ?? 0;
  return { prompt, gen, tokens: t.estTokens ?? prompt + gen, native: false };
}

function addCost(row: TokenChartPoint, t: TurnSample): void {
  const cost = turnCost(t);
  row.prompt += cost.prompt;
  row.gen += cost.gen;
  row.tokens += cost.tokens;
  row.turns += 1;
}

const MAX_BINS = 800;

export function tokenChartSeries(
  turns: TurnSample[],
  opts: { bucket: SpendBucket; since: number | null; now: number },
): TokenChartPoint[] {
  const { bucket, since, now } = opts;
  if (turns.length === 0) {
    return [];
  }
  const inWindow = [...filterSamples(turns, since, now)].sort((a, b) => a.at - b.at);

  if (bucket === "cumulative") {
    const points: TokenChartPoint[] = [];
    const start = since ?? inWindow[0]?.at ?? now;
    if (inWindow.length === 0 || start < inWindow[0].at) {
      points.push({ at: start, prompt: 0, gen: 0, tokens: 0, turns: 0 });
    }
    const run: TokenChartPoint = { at: start, prompt: 0, gen: 0, tokens: 0, turns: 0 };
    for (const t of inWindow) {
      addCost(run, t);
      points.push({ at: t.at, prompt: run.prompt, gen: run.gen, tokens: run.tokens, turns: run.turns });
    }
    const last = points[points.length - 1];
    if (last && last.at < now) {
      points.push({ ...last, at: now });
    }
    return points;
  }

  const start = alignBucket(since ?? inWindow[0]?.at ?? now, bucket);
  const end = alignBucket(now, bucket);
  const bins = new Map<number, TokenChartPoint>();
  let t = start;
  for (let i = 0; i < MAX_BINS && t <= end; i += 1) {
    bins.set(t, { at: t, prompt: 0, gen: 0, tokens: 0, turns: 0 });
    t = nextBucket(t, bucket);
  }
  for (const row of inWindow) {
    const key = alignBucket(row.at, bucket);
    const bin = bins.get(key) ?? { at: key, prompt: 0, gen: 0, tokens: 0, turns: 0 };
    addCost(bin, row);
    bins.set(key, bin);
  }
  return [...bins.values()].sort((a, b) => a.at - b.at);
}

function sourceKey(source: string | null): (typeof SOURCE_ORDER)[number] {
  return spendSource(source);
}

function emptySources(at: number): SourceChartPoint {
  return { at, user: 0, cron: 0, watch: 0, reaction: 0, unknown: 0 };
}

export function sourceChartSeries(
  turns: TurnSample[],
  opts: { bucket: SpendBucket; since: number | null; now: number },
): SourceChartPoint[] {
  const { bucket, since, now } = opts;
  const inWindow = [...filterSamples(turns, since, now)].sort((a, b) => a.at - b.at);
  if (inWindow.length === 0) {
    return [];
  }

  if (bucket === "cumulative") {
    const points: SourceChartPoint[] = [];
    const start = since ?? inWindow[0].at;
    const run = emptySources(start);
    if (start < inWindow[0].at) {
      points.push({ ...run });
    }
    for (const t of inWindow) {
      run[sourceKey(t.source)] += 1;
      points.push({ ...run, at: t.at });
    }
    const last = points[points.length - 1];
    if (last && last.at < now) {
      points.push({ ...last, at: now });
    }
    return points;
  }

  const start = alignBucket(since ?? inWindow[0].at, bucket);
  const end = alignBucket(now, bucket);
  const bins = new Map<number, SourceChartPoint>();
  let t = start;
  for (let i = 0; i < MAX_BINS && t <= end; i += 1) {
    bins.set(t, emptySources(t));
    t = nextBucket(t, bucket);
  }
  for (const row of inWindow) {
    const key = alignBucket(row.at, bucket);
    const bin = bins.get(key) ?? emptySources(key);
    bin[sourceKey(row.source)] += 1;
    bins.set(key, bin);
  }
  return [...bins.values()].sort((a, b) => a.at - b.at);
}

/** Bytes/sec from consecutive Docker counters. A recreate (counter reset) is idle, not negative. */
export function netBps(prev: number, cur: number, dtSec: number): number {
  if (!(dtSec > 0) || !Number.isFinite(prev) || !Number.isFinite(cur)) {
    return 0;
  }
  const delta = cur - prev;
  if (delta < 0) {
    return 0;
  }
  return delta / dtSec;
}

export function hostNetRates(spark: HostSample[]): HostNetRate[] {
  return spark.map((s, i) => {
    const prev = spark[i - 1];
    const dt = prev ? (s.at - prev.at) / 1000 : 0;
    const rates = { at: s.at } as HostNetRate;
    for (const key of HOST_NET_KEYS) {
      rates[key] = prev ? netBps(prev[key], s[key], dt) : 0;
    }
    return rates;
  });
}

export function lastHostNetRate(spark: HostSample[]): HostNetRate | null {
  if (spark.length < 2) {
    return null;
  }
  return hostNetRates(spark).at(-1) ?? null;
}
