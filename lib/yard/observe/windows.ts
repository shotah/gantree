export const SPEND_WINDOWS = ["1h", "6h", "12h", "24h", "7d", "month", "all"] as const;
export type SpendWindow = (typeof SPEND_WINDOWS)[number];
export const DEFAULT_SPEND_WINDOW: SpendWindow = "month";

export const SPEND_BUCKETS = ["cumulative", "hour", "6h", "12h", "day"] as const;
export type SpendBucket = (typeof SPEND_BUCKETS)[number];
export type SpendRateBucket = Exclude<SpendBucket, "cumulative">;

export const SOURCE_ORDER = ["user", "cron", "watch", "reaction", "unknown"] as const;
export const CONTRACT_SOURCES = ["user", "cron", "watch", "reaction"] as const;

/** Contract `source` only. Empty, legacy, or any other string charts as unknown. */
export function spendSource(source: string | null | undefined): (typeof SOURCE_ORDER)[number] {
  if (source && (CONTRACT_SOURCES as readonly string[]).includes(source)) {
    return source as (typeof CONTRACT_SOURCES)[number];
  }
  return "unknown";
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
