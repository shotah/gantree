"use client";

import type { ReactNode } from "react";
import type { SpendBucket } from "@/lib/yard/observe/spend";
import { WhenVisible } from "./WhenVisible";

export const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #3f3f46" };

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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {empty
        ? (
            <p className="py-8 text-center text-xs text-zinc-600">{hint ?? "no samples yet — leave this page open"}</p>
          )
        : (
            <>
              <div className="h-40 max-sm:h-52">
                <WhenVisible>{children}</WhenVisible>
              </div>
              {caption ? <p className="mt-1.5 text-[10px] text-zinc-600">{caption}</p> : null}
            </>
          )}
    </div>
  );
}
