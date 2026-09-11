export const SPEND_WINDOWS = ["1h", "6h", "12h", "24h", "7d", "month", "all"] as const;
export type SpendWindow = (typeof SPEND_WINDOWS)[number];
export const DEFAULT_SPEND_WINDOW: SpendWindow = "month";

export const SPEND_BUCKETS = ["cumulative", "hour", "6h", "12h", "day"] as const;
export type SpendBucket = (typeof SPEND_BUCKETS)[number];
export type SpendRateBucket = Exclude<SpendBucket, "cumulative">;

export const SOURCE_ORDER = ["user", "cron", "watch", "reaction", "unknown"] as const;
export const CONTRACT_SOURCES = ["user", "cron", "watch", "reaction"] as const;

const SOURCE_ALIAS: Record<string, (typeof CONTRACT_SOURCES)[number]> = {
  user: "user",
  telegram: "user",
  tg: "user",
  pendant: "user",
  slack: "user",
  discord: "user",
  google: "user",
  phone: "user",
  chat: "user",
  channel: "user",
  human: "user",
  cron: "cron",
  schedule: "cron",
  scheduled: "cron",
  heartbeat: "cron",
  watch: "watch",
  watcher: "watch",
  reaction: "reaction",
};

/** Contract `source`, plus channel aliases and session_id prefixes. Empty → unknown. */
export function spendSource(
  source: string | null | undefined,
  sessionId?: string | null,
): (typeof SOURCE_ORDER)[number] {
  const aliased = aliasOf(source);
  if (aliased) {
    return aliased;
  }
  const session = (sessionId ?? "").trim().toLowerCase();
  const head = session.split(":")[0];
  return SOURCE_ALIAS[head] ?? "unknown";
}

function aliasOf(raw: string | null | undefined): (typeof CONTRACT_SOURCES)[number] | null {
  const s = (raw ?? "").trim().toLowerCase();
  return s ? (SOURCE_ALIAS[s] ?? null) : null;
}

export function parseSpendWindow(raw: string | null | undefined): SpendWindow {
  return SPEND_WINDOWS.includes(raw as SpendWindow) ? (raw as SpendWindow) : DEFAULT_SPEND_WINDOW;
}

/** Midnight on the 1st in `timeZone` (Settings), else the Mini's local clock. */
export function monthStart(now = Date.now(), timeZone?: string | null): number {
  if (!timeZone) {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const p = zonedParts(now, timeZone);
  return zonedWallToUtc(p.year, p.month, 1, 0, 0, 0, timeZone);
}

export function windowStart(window: SpendWindow, now = Date.now(), timeZone?: string | null): number | null {
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
      return monthStart(now, timeZone);
    case "all":
      return null;
  }
}

export function daysInMonthAt(start: number, timeZone?: string | null): number {
  if (!timeZone) {
    const d = new Date(start);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }
  const p = zonedParts(start, timeZone);
  return new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
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

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: n("year"),
    month: n("month"),
    day: n("day"),
    hour: n("hour"),
    minute: n("minute"),
    second: n("second"),
  };
}

function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const shown = zonedParts(utc, timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    utc += want - shownAsUtc;
  }
  return utc;
}
