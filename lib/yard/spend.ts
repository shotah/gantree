import type { SpendRollup, SpendSlice, TurnSample, YardSpend } from "./types";

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