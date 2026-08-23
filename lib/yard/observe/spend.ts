import type { SpendRollup, SpendSlice, TurnSample, YardSpend } from "../types";

export const SPEND_WINDOWS = ["1h", "6h", "12h", "24h", "7d", "all"] as const;
export type SpendWindow = (typeof SPEND_WINDOWS)[number];

export const SPEND_BUCKETS = ["cumulative", "hour", "6h", "12h", "day"] as const;
export type SpendBucket = (typeof SPEND_BUCKETS)[number];
export type SpendRateBucket = Exclude<SpendBucket, "cumulative">;

export type TokenChartPoint = {
  at: number;
  prompt: number;
  gen: number;
  tokens: number;
  turns: number;
};

export function fmtEstTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0";
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(2)}k`;
  }
  return String(Math.round(n));
}

function slices(map: Map<string, { turns: number; estTokens: number }>): SpendSlice[] {
  return [...map.entries()]
    .map(([id, v]) => ({ id, turns: v.turns, estTokens: v.estTokens }))
    .sort((a, b) => b.estTokens - a.estTokens);
}

export function rollupTurns(slug: string, turns: TurnSample[]): SpendRollup {
  const byUser = new Map<string, { turns: number; estTokens: number }>();
  const bySource = new Map<string, { turns: number; estTokens: number }>();
  let promptEst = 0;
  let genEst = 0;
  let estTokens = 0;
  let lastAt: number | null = null;
  let unattributedTurns = 0;
  for (const t of turns) {
    const cost = t.estTokens ?? 0;
    promptEst += t.promptEstTokens ?? 0;
    genEst += t.genEstTokens ?? 0;
    estTokens += cost;
    if (lastAt == null || t.at > lastAt) {
      lastAt = t.at;
    }
    if (t.userId) {
      const cur = byUser.get(t.userId) ?? { turns: 0, estTokens: 0 };
      cur.turns += 1;
      cur.estTokens += cost;
      byUser.set(t.userId, cur);
    } else {
      unattributedTurns += 1;
    }
    const src = t.source || "unknown";
    const sc = bySource.get(src) ?? { turns: 0, estTokens: 0 };
    sc.turns += 1;
    sc.estTokens += cost;
    bySource.set(src, sc);
  }
  return {
    slug,
    turns: turns.length,
    promptEst,
    genEst,
    estTokens,
    lastAt,
    byUser: slices(byUser),
    bySource: slices(bySource),
    unattributedTurns,
  };
}

export function combineSpend(cranes: SpendRollup[]): YardSpend {
  const ranked = [...cranes].filter((c) => c.turns > 0).sort((a, b) => b.estTokens - a.estTokens);
  return {
    turns: ranked.reduce((n, c) => n + c.turns, 0),
    promptEst: ranked.reduce((n, c) => n + c.promptEst, 0),
    genEst: ranked.reduce((n, c) => n + c.genEst, 0),
    estTokens: ranked.reduce((n, c) => n + c.estTokens, 0),
    cranes: ranked,
  };
}

export function parseSpendWindow(raw: string | null | undefined): SpendWindow {
  return SPEND_WINDOWS.includes(raw as SpendWindow) ? (raw as SpendWindow) : "24h";
}

export function windowStart(window: SpendWindow, now = Date.now()): number | null {
  switch (window) {
    case "1h":
      return now - 3600_000;
    case "6h":
      return now - 6 * 3600_000;
    case "12h":
      return now - 12 * 3600_000;
    case "24h":
      return now - 24 * 3600_000;
    case "7d":
      return now - 7 * 24 * 3600_000;
    case "all":
      return null;
  }
}

export function fmtSpendWindow(window: SpendWindow): string {
  return window === "all" ? "all sampled" : `last ${window}`;
}

export function fmtSpendBucketTitle(bucket: SpendBucket): string {
  switch (bucket) {
    case "cumulative":
      return "est. tokens (cumulative)";
    case "hour":
      return "est. tokens / hour";
    case "6h":
      return "est. tokens / 6h";
    case "12h":
      return "est. tokens / 12h";
    case "day":
      return "est. tokens / day";
  }
}

export function bucketsForWindow(window: SpendWindow): SpendBucket[] {
  switch (window) {
    case "1h":
      return ["cumulative", "hour"];
    case "6h":
      return ["cumulative", "hour", "6h"];
    case "12h":
      return ["cumulative", "hour", "6h", "12h"];
    default:
      return [...SPEND_BUCKETS];
  }
}

export function filterSamples<T extends { at: number }>(rows: T[], since: number | null, now?: number): T[] {
  return rows.filter((r) => (since == null || r.at >= since) && (now == null || r.at <= now));
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

function addCost(row: TokenChartPoint, t: TurnSample): void {
  const prompt = t.promptEstTokens ?? 0;
  const gen = t.genEstTokens ?? 0;
  row.prompt += prompt;
  row.gen += gen;
  row.tokens += t.estTokens ?? prompt + gen;
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