import type { LastTurn, SpendRollup, SpendSlice, SpendTrajectory, TurnSample, YardSpend } from "../types";
import { turnHasNative } from "./chart";
import { SOURCE_ORDER, spendSource, windowStart, type SpendWindow } from "./windows";

export type { SpendBucket, SpendRateBucket, SpendWindow } from "./windows";
export {
  DEFAULT_SPEND_WINDOW,
  SOURCE_ORDER,
  SPEND_BUCKETS,
  SPEND_WINDOWS,
  bucketsForWindow,
  monthStart,
  parseSpendWindow,
  spendSource,
  windowStart,
} from "./windows";
export {
  FAT_DATA_DIR_BYTES,
  estSpendUsd,
  fmtAgo,
  fmtBps,
  fmtBytes,
  fmtCores,
  fmtEstTokens,
  fmtSpendBucketTitle,
  fmtSpendWindow,
  fmtUsd,
  hostShare,
  lastDiskBytes,
} from "./fmt";
export type { HostNetRate, SourceChartPoint, TokenChartPoint } from "./chart";
export {
  alignBucket,
  filterSamples,
  hostNetRates,
  lastHostNetRate,
  netBps,
  sourceChartSeries,
  thinChartPoints,
  tokenChartSeries,
  turnCost,
  turnHasNative,
} from "./chart";

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
    promptTokens: best.promptTokens ?? null,
    completionTokens: best.completionTokens ?? null,
    totalTokens: best.totalTokens ?? null,
    model: best.model ?? null,
    finishReason: best.finishReason ?? null,
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
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let nativeTurns = 0;
  let cachedTokens = 0;
  let reasoningTokens = 0;
  let lastAt: number | null = null;
  let unattributedTurns = 0;
  let recoveries = 0;
  let userTurns = 0;
  let userEst = 0;
  for (const t of turns) {
    const cost = t.estTokens ?? 0;
    const src = spendSource(t.source);
    promptEst += t.promptEstTokens ?? 0;
    genEst += t.genEstTokens ?? 0;
    estTokens += cost;
    if (turnHasNative(t)) {
      nativeTurns += 1;
      promptTokens += t.promptTokens ?? 0;
      completionTokens += t.completionTokens ?? 0;
      totalTokens += t.totalTokens ?? (t.promptTokens ?? 0) + (t.completionTokens ?? 0);
      cachedTokens += t.cachedTokens ?? 0;
      reasoningTokens += t.reasoningTokens ?? 0;
    }
    if (lastAt == null || t.at > lastAt) {
      lastAt = t.at;
    }
    if (t.userId) {
      addSlice(byUser, t.userId, 1, cost);
    } else if (src === "user" || src === "reaction") {
      unattributedTurns += 1;
    }
    addSlice(bySource, src, 1, cost);
    addSlice(byOutcome, t.outcome || "ok", 1, cost);
    if (t.rounds != null) {
      roundSamples.push(t.rounds);
    }
    recoveries += t.recoveries ?? 0;
    if (src === "user") {
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
    promptTokens,
    completionTokens,
    totalTokens,
    nativeTurns,
    cachedTokens,
    reasoningTokens,
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
    promptTokens: ranked.reduce((n, c) => n + (c.promptTokens ?? 0), 0),
    completionTokens: ranked.reduce((n, c) => n + (c.completionTokens ?? 0), 0),
    totalTokens: ranked.reduce((n, c) => n + (c.totalTokens ?? 0), 0),
    nativeTurns: ranked.reduce((n, c) => n + (c.nativeTurns ?? 0), 0),
    cachedTokens: ranked.reduce((n, c) => n + (c.cachedTokens ?? 0), 0),
    reasoningTokens: ranked.reduce((n, c) => n + (c.reasoningTokens ?? 0), 0),
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

/** USD calculator uses native prompt/completion when every turn in the window had usage. */
export function spendUsdSides(r: {
  turns: number;
  promptEst: number;
  genEst: number;
  promptTokens?: number;
  completionTokens?: number;
  nativeTurns?: number;
}): { prompt: number; gen: number; kind: "native" | "est" | "mixed" } {
  const nativeTurns = r.nativeTurns ?? 0;
  if (r.turns > 0 && nativeTurns >= r.turns) {
    return { prompt: r.promptTokens ?? 0, gen: r.completionTokens ?? 0, kind: "native" };
  }
  return { prompt: r.promptEst, gen: r.genEst, kind: nativeTurns > 0 ? "mixed" : "est" };
}

export function unknownShare(r: { turns: number; bySource: SpendSlice[] }): number {
  if (r.turns <= 0) {
    return 0;
  }
  const unknown = r.bySource.find((s) => s.id === "unknown");
  return (unknown?.turns ?? 0) / r.turns;
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
