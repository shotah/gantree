"use client";

import type { ReactNode } from "react";
import type { SpendBucket } from "@/lib/yard/observe/spend";
import { WhenVisible } from "./WhenVisible";

export const CHART_GRID = "var(--line)";
export const CHART_TICK = { fill: "var(--dim)", fontSize: 10 };
export const CHART_TOOLTIP = {
  background: "var(--panel)",
  border: "1px solid var(--edge)",
  color: "var(--fg)",
};

export const SERIES = {
  accent: "var(--accent)",
  ok: "var(--ok)",
  info: "var(--info)",
  dim: "var(--dim)",
  body: "var(--body)",
  danger: "var(--danger)",
  warn: "var(--warn)",
  reaction: "var(--reaction)",
  tx: "var(--chart-tx)",
  write: "var(--chart-write)",
  disk: "var(--chart-disk)",
} as const;

export function wash(color: string, pct = 20): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function fmtTick(at: number, spanMs: number, bucket: SpendBucket, timeZone?: string | null): string {
  const d = new Date(at);
  const tz = timeZone ? { timeZone } : {};
  if (bucket === "day") {
    return d.toLocaleDateString([], { month: "short", day: "numeric", ...tz });
  }
  if (spanMs >= 36 * 3600_000) {
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", ...tz });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...tz });
}

export function spanOf(rows: { at: number }[]): number {
  if (rows.length < 2) {
    return 0;
  }
  return rows[rows.length - 1].at - rows[0].at;
}

export function mib(bytes: number | null | undefined): number | null {
  if (bytes == null) {
    return null;
  }
  return Number((bytes / 1024 / 1024).toFixed(2));
}

export function ChartFrame({
  title,
  empty,
  hint,
  caption,
  children,
}: {
  title: string;
  empty: boolean;
  hint?: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-line bg-panel/50 p-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-dim">{title}</h3>
      {empty
        ? (
            <p className="py-8 text-center text-xs text-faint">{hint ?? "no samples yet — leave this page open"}</p>
          )
        : (
            <>
              <div className="h-40 w-full min-w-0 max-sm:h-52">
                <WhenVisible>{children}</WhenVisible>
              </div>
              {caption ? <p className="mt-1.5 text-[10px] text-faint">{caption}</p> : null}
            </>
          )}
    </div>
  );
}
