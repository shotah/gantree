export const BOARD_ORDER_KEY = "gantree.board.v1";
export const HOST_CARD_ID = "host";
export const BOARDS_CARD_ID = "boards";

export function parseBoardOrder(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function applyBoardOrder(ids: string[], order: string[]): string[] {
  const pending = new Set(ids);
  const out: string[] = [];
  for (const id of order) {
    if (pending.has(id)) {
      out.push(id);
      pending.delete(id);
    }
  }
  for (const id of ids) {
    if (pending.has(id)) {
      out.push(id);
    }
  }
  return out;
}

export function moveBoardId(ids: string[], from: string, to: string): string[] {
  if (from === to) {
    return ids;
  }
  const fromI = ids.indexOf(from);
  const toI = ids.indexOf(to);
  if (fromI < 0 || toI < 0) {
    return ids;
  }
  const next = ids.slice();
  next.splice(fromI, 1);
  next.splice(toI, 0, from);
  return next;
}

/** Reorder among the visible subset, leaving hidden ids where they are. */
export function moveVisibleBoardId(full: string[], visible: string[], from: string, to: string): string[] {
  const moved = moveBoardId(visible, from, to);
  const vis = new Set(visible);
  let i = 0;
  return full.map((id) => (vis.has(id) ? moved[i++] ?? id : id));
}

export function readBoardOrder(): string[] {
  try {
    return parseBoardOrder(localStorage.getItem(BOARD_ORDER_KEY));
  } catch {
    return [];
  }
}

export function writeBoardOrder(ids: string[]): void {
  try {
    localStorage.setItem(BOARD_ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* private mode */
  }
}
