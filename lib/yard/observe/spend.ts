import type { HostSample, LastTurn, SpendRollup, SpendSlice, SpendTrajectory, TurnSample, YardSpend } from "../types";

export const SPEND_WINDOWS = ["1h", "6h", "12h", "24h", "7d", "month", "all"] as const;
export type SpendWindow = (typeof SPEND_WINDOWS)[number];
export const DEFAULT_SPEND_WINDOW: SpendWindow = "month";

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

export function estSpendUsd(
  promptEst: number,
  genEst: number,
  rates?: { promptUsdPerMillion: number | null; genUsdPerMillion: number | null } | null,
): number | null {
  if (!rates || (rates.promptUsdPerMillion == null && rates.genUsdPerMillion == null)) {
    return null;
  }
  const p = rates.promptUsdPerMillion ?? 0;
  const g = rates.genUsdPerMillion ?? 0;
  return (promptEst / 1e6) * p + (genEst / 1e6) * g;
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "$0";
  }
  if (n < 0.01) {
    return `$${n.toFixed(4)}`;
  }
  return `$${n.toFixed(2)}`;
}

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

export const SOURCE_ORDER = ["user", "cron", "watch", "reaction", "unknown"] as const;

export function emptyTrajectory(): SpendTrajectory {
  return { medianRounds: null, recoveries: 0, byOutcome: [], userTurns: 0, userEst: 0 };
}

function median(nums: number[]): number | null {
  if (nums.length === 0) {
    return null;
  }
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function lastTurnOf(turns: TurnSample[]): LastTurn | null {
  let best: TurnSample | null = null;
  for (const t of turns) {
    if (!best || t.at > best.at) {
      best = t;
    }
  }
  if (!best) {
    return null;
  }
  return {
    at: best.at,
    source: best.source,
    outcome: best.outcome,
    estTokens: best.estTokens ?? 0,
    rounds: best.rounds,
    durationMs: best.durationMs ?? null,
  };
}

function slices(map: Map<string, { turns: number; estTokens: number }>): SpendSlice[] {
  return [...map.entries()]
    .map(([id, v]) => ({ id, turns: v.turns, estTokens: v.estTokens }))
    .sort((a, b) => b.estTokens - a.estTokens);
}

function addSlice(map: Map<string, { turns: number; estTokens: number }>, id: string, turns: number, estTokens: number): void {
  const cur = map.get(id) ?? { turns: 0, estTokens: 0 };
  cur.turns += turns;
  cur.estTokens += estTokens;
  map.set(id, cur);
}

export function rollupTurns(slug: string, turns: TurnSample[]): SpendRollup {
  const byUser = new Map<string, { turns: number; estTokens: number }>();
  const bySource = new Map<string, { turns: number; estTokens: number }>();
  const byOutcome = new Map<string, { turns: number; estTokens: number }>();
  const roundSamples: number[] = [];
  let promptEst = 0;
  let genEst = 0;
  let estTokens = 0;
  let lastAt: number | null = null;
  let unattributedTurns = 0;
  let recoveries = 0;
  let userTurns = 0;
  let userEst = 0;
  for (const t of turns) {
    const cost = t.estTokens ?? 0;
    promptEst += t.promptEstTokens ?? 0;
    genEst += t.genEstTokens ?? 0;
    estTokens += cost;
    if (lastAt == null || t.at > lastAt) {
      lastAt = t.at;
    }
    if (t.userId) {
      addSlice(byUser, t.userId, 1, cost);
    } else {
      unattributedTurns += 1;
    }
    addSlice(bySource, t.source || "unknown", 1, cost);
    addSlice(byOutcome, t.outcome || "ok", 1, cost);
    if (t.rounds != null) {
      roundSamples.push(t.rounds);
    }
    recoveries += t.recoveries ?? 0;
    if (t.source === "user") {
      userTurns += 1;
      userEst += cost;
    }
  }
  return {
    slug,
    turns: turns.length,
    promptEst,
    genEst,
    estTokens,
    lastAt,
    lastTurn: lastTurnOf(turns),
    byUser: slices(byUser),
    bySource: slices(bySource),
    unattributedTurns,
    trajectory: {
      medianRounds: median(roundSamples),
      recoveries,
      byOutcome: slices(byOutcome),
      userTurns,
      userEst,
    },
  };
}

export type ChannelNameInput = {
  name: string;
  displayName: string;
  channels: { telegram: string[]; slack: string[]; discord: string[] };
};

/** Map Telegram / Slack / Discord ids on operator profiles to a display name. */
export function namesFromOperators(ops: ChannelNameInput[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const op of ops) {
    const label = op.displayName.trim() || op.name;
    for (const ids of [op.channels.telegram, op.channels.slack, op.channels.discord]) {
      for (const id of ids) {
        if (id && !names[id]) {
          names[id] = label;
        }
      }
    }
  }
  return names;
}

export function labelSlices(slices: SpendSlice[], names: Record<string, string>): SpendSlice[] {
  return slices.map((s) => {
    const label = names[s.id];
    return label ? { ...s, label } : s;
  });
}

export function labelRollup(rollup: SpendRollup, names: Record<string, string>): SpendRollup {
  return { ...rollup, byUser: labelSlices(rollup.byUser, names) };
}

export function labelSpend(spend: YardSpend, names: Record<string, string>): YardSpend {
  return { ...spend, cranes: spend.cranes.map((c) => labelRollup(c, names)) };
}

export function combineSpend(cranes: SpendRollup[], now = Date.now()): YardSpend {
  const ranked = [...cranes].filter((c) => c.turns > 0).sort((a, b) => b.estTokens - a.estTokens);
  const bySource = new Map<string, { turns: number; estTokens: number }>();
  const byOutcome = new Map<string, { turns: number; estTokens: number }>();
  let lastTurn: LastTurn | null = null;
  let lastAt: number | null = null;
  let recoveries = 0;
  let userTurns = 0;
  let userEst = 0;
  for (const c of ranked) {
    if (c.lastAt != null && (lastAt == null || c.lastAt > lastAt)) {
      lastAt = c.lastAt;
    }
    if (c.lastTurn && (!lastTurn || c.lastTurn.at > lastTurn.at)) {
      lastTurn = c.lastTurn;
    }
    recoveries += c.trajectory.recoveries;
    userTurns += c.trajectory.userTurns;
    userEst += c.trajectory.userEst;
    for (const s of c.bySource) {
      addSlice(bySource, s.id, s.turns, s.estTokens);
    }
    for (const s of c.trajectory.byOutcome) {
      addSlice(byOutcome, s.id, s.turns, s.estTokens);
    }
  }
  return {
    turns: ranked.reduce((n, c) => n + c.turns, 0),
    promptEst: ranked.reduce((n, c) => n + c.promptEst, 0),
    genEst: ranked.reduce((n, c) => n + c.genEst, 0),
    estTokens: ranked.reduce((n, c) => n + c.estTokens, 0),
    lastAt,
    lastTurn,
    bySource: slices(bySource),
    trajectory: {
      medianRounds: null,
      recoveries,
      byOutcome: slices(byOutcome),
      userTurns,
      userEst,
    },
    sampledAt: now,
    cranes: ranked,
  };
}

export function parseSpendWindow(raw: string | null | undefined): SpendWindow {
  return SPEND_WINDOWS.includes(raw as SpendWindow) ? (raw as SpendWindow) : DEFAULT_SPEND_WINDOW;
}

/** Local midnight on the 1st — Gemini / GCP calendar-month billing. */
export function monthStart(now = Date.now()): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
    case "month":
      return monthStart(now);
    case "all":
      return null;
  }
}

export function fmtSpendWindow(window: SpendWindow): string {
  if (window === "all") {
    return "all sampled";
  }
  if (window === "month") {
    return "this month";
  }
  return `last ${window}`;
}

export function fmtAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) {
    return `${s}s ago`;
  }
  const m = Math.round(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.round(m / 60);
  if (h < 48) {
    return `${h}h ago`;
  }
  return `${Math.round(h / 24)}d ago`;
}

export function spendPace(
  estTokens: number,
  window: SpendWindow,
  now = Date.now(),
): { perDay: number; projected: number | null } | null {
  if (estTokens <= 0) {
    return null;
  }
  const start = windowStart(window, now);
  if (start == null) {
    return null;
  }
  const elapsed = Math.max(now - start, 60_000);
  const perDay = estTokens / (elapsed / 86_400_000);
  if (window !== "month") {
    return { perDay, projected: null };
  }
  const d = new Date(start);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { perDay, projected: perDay * daysInMonth };
}

export function orderedSources(slices: SpendSlice[]): SpendSlice[] {
  const rank = new Map<string, number>(SOURCE_ORDER.map((id, i) => [id, i]));
  return [...slices].sort((a, b) => {
    const da = rank.get(a.id) ?? 50;
    const db = rank.get(b.id) ?? 50;
    if (da !== db) {
      return da - db;
    }
    return b.estTokens - a.estTokens;
  });
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0";
  }
  if (n >= 1024 ** 3) {
    return `${(n / 1024 ** 3).toFixed(1)} GiB`;
  }
  if (n >= 1024 ** 2) {
    return `${Math.round(n / 1024 ** 2)} MiB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} KiB`;
  }
  return `${Math.round(n)} B`;
}

/** Show data-dir size on a card once it is no longer tiny. */
export const FAT_DATA_DIR_BYTES = 256 * 1024 * 1024;

export function lastDiskBytes(samples: { diskBytes?: number | null }[] | undefined): number | null {
  if (!samples?.length) {
    return null;
  }
  for (let i = samples.length - 1; i >= 0; i--) {
    const n = samples[i]?.diskBytes;
    if (typeof n === "number" && n > 0) {
      return n;
    }
  }
  return null;
}

export function fmtBps(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0 B/s";
  }
  return `${fmtBytes(n)}/s`;
}

const HOST_NET_KEYS = ["craneRx", "craneTx", "consoleRx", "consoleTx", "otherRx", "otherTx"] as const;

export type HostNetRate = { at: number } & Record<(typeof HOST_NET_KEYS)[number], number>;

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
    const n = (key: (typeof HOST_NET_KEYS)[number]) => (prev ? netBps(prev[key], s[key], dt) : 0);
    return {
      at: s.at,
      craneRx: n("craneRx"),
      craneTx: n("craneTx"),
      consoleRx: n("consoleRx"),
      consoleTx: n("consoleTx"),
      otherRx: n("otherRx"),
      otherTx: n("otherTx"),
    };
  });
}

export function lastHostNetRate(spark: HostSample[]): HostNetRate | null {
  if (spark.length < 2) {
    return null;
  }
  return hostNetRates(spark).at(-1) ?? null;
}

/** Docker CPU % is 100 = one full core. */
export function fmtCores(cpuPercent: number): string {
  if (!Number.isFinite(cpuPercent) || cpuPercent <= 0) {
    return "0";
  }
  return (cpuPercent / 100).toFixed(cpuPercent >= 100 ? 1 : 2);
}

export function hostShare(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, used / total));
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

export type SourceChartPoint = { at: number } & Record<(typeof SOURCE_ORDER)[number], number>;

function sourceKey(source: string | null): (typeof SOURCE_ORDER)[number] {
  if (source && (SOURCE_ORDER as readonly string[]).includes(source)) {
    return source as (typeof SOURCE_ORDER)[number];
  }
  return "unknown";
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