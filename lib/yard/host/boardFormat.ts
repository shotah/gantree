import type { BoardRosterEntry } from "../types";

/** Catalog from boards-mcp. Kind is the number; sport lives in the title. */
export const BOARD_KIND_CATALOG: Record<string, { label: string; decimals: 0 | 1 }> = {
  steps: { label: "steps", decimals: 0 },
  distance: { label: "km", decimals: 1 },
  elevation: { label: "m", decimals: 0 },
  move: { label: "move", decimals: 0 },
  sleep: { label: "sleep", decimals: 1 },
  count: { label: "count", decimals: 0 },
  custom: { label: "custom", decimals: 0 },
};

export function displayBoardName(roster: BoardRosterEntry[], author: string): string {
  const hit = roster.find((r) => r.author === author);
  if (!hit) {
    return author;
  }
  return hit.userName || hit.agentName || author;
}

export function formatBoardScore(kind: string, value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const spec = BOARD_KIND_CATALOG[kind.trim()];
  if (spec?.decimals === 1) {
    return (Math.round(value * 10) / 10).toLocaleString();
  }
  return Math.round(value).toLocaleString();
}

export function boardKindLabel(kind: string): string {
  const k = kind.trim();
  return BOARD_KIND_CATALOG[k]?.label ?? k.replaceAll("_", " ");
}
