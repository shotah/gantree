"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  filterSamples,
  fmtEstTokens,
  fmtSpendBucketTitle,
  tokenChartSeries,
  type SpendBucket,
} from "@/lib/yard/observe/spend";
import type { McpSample, StatSample, TurnSample, UptimeSample } from "@/lib/yard/types";

function fmtTick(at: number, spanMs: number, bucket: SpendBucket): string {
  const d = new Date(at);
  if (bucket === "day") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  if (spanMs >= 36 * 3600_000) {
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function spanOf(rows: { at: number }[]): number {
  if (rows.length < 2) {
    return 0;
  }
  return rows[rows.length - 1].at - rows[0].at;
}

function ChartFrame({
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
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {empty ? (
        <p className="py-8 text-center text-xs text-zinc-600">{hint ?? "no samples yet — leave this page open"}</p>
      ) : (
        <>
          <div className="h-40">{children}</div>
          {caption ? <p className="mt-1.5 text-[10px] text-zinc-600">{caption}</p> : null}
        </>
      )}
    </div>
  );
}

export function MetricCharts({
  host,
  turns,
  mcp,
  uptime,
  bucket,
  since,
  now,
}: {
  host: StatSample[];
  turns: TurnSample[];
  mcp: McpSample[];
  uptime: UptimeSample[];
  bucket: SpendBucket;
  since: number | null;
  now: number;
}) {
  const hostIn = filterSamples(host, since, now);
  const turnsIn = filterSamples(turns, since, now);
  const mcpIn = filterSamples(mcp, since, now);
  const uptimeIn = filterSamples(uptime, since, now);
  const tokenPts = tokenChartSeries(turns, { bucket, since, now });
  const hostSpan = spanOf(hostIn);
  const turnSpan = spanOf(turnsIn);
  const tokenSpan = spanOf(tokenPts);
  const mcpSpan = spanOf(mcpIn);
  const uptimeSpan = spanOf(uptimeIn);
  const hostRows = hostIn.map((s) => ({
    t: fmtTick(s.at, hostSpan, "hour"),
    cpu: s.cpuPercent == null ? null : Number(s.cpuPercent.toFixed(1)),
    mem: s.memBytes == null ? null : Number((s.memBytes / 1024 / 1024).toFixed(1)),
  }));
  const tokenRows = tokenPts.map((s) => ({
    t: fmtTick(s.at, tokenSpan, bucket),
    tokens: s.tokens,
    prompt: s.prompt,
    gen: s.gen,
  }));
  const turnRows = [...turnsIn]
    .sort((a, b) => a.at - b.at)
    .map((s) => ({
      t: fmtTick(s.at, turnSpan, bucket),
      rounds: s.rounds,
      recoveries: s.recoveries,
    }));
  const mcpRows = mcpIn.map((s) => ({
    t: fmtTick(s.at, mcpSpan, "hour"),
    published: s.published,
    skipped: s.skipped,
  }));
  const uptimeRows = uptimeIn.map((s) => ({
    t: fmtTick(s.at, uptimeSpan, "hour"),
    uptimeMin: s.uptimeSeconds == null ? null : Number((s.uptimeSeconds / 60).toFixed(1)),
    restarts: s.restartCount,
  }));
  const tooltip = { background: "#18181b", border: "1px solid #3f3f46" };
  const hasSplit = tokenRows.some((r) => r.prompt > 0 || r.gen > 0);
  const tokenLine = bucket === "cumulative" ? "stepAfter" : "monotone";

  return (
    <div className="grid gap-3 md:grid-cols-2" data-shot="metrics">
      <ChartFrame title="CPU %" empty={hostRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={hostRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="cpu" type="monotone" stroke="#f59e0b" fill="#f59e0b33" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="Memory (MiB)" empty={hostRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={hostRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="mem" type="monotone" stroke="#e7e5e4" fill="#e7e5e422" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame
        title={fmtSpendBucketTitle(bucket)}
        empty={tokenRows.length === 0}
        hint="no turn perf in docker logs — send a chat, then refresh"
        caption={
          bucket === "cumulative"
            ? "running sum of each turn · idle holds the total"
            : "tokens spent in each bucket · idle is 0"
        }
      >
        <ResponsiveContainer>
          <AreaChart data={tokenRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} tickFormatter={fmtEstTokens} />
            <Tooltip contentStyle={tooltip} formatter={(value) => fmtEstTokens(typeof value === "number" ? value : 0)} />
            {hasSplit ? (
              <>
                <Area dataKey="prompt" name="prompt est" type={tokenLine} stroke="#34d399" fill="#34d39922" stackId="tok" />
                <Area dataKey="gen" name="gen est" type={tokenLine} stroke="#6ee7b7" fill="#6ee7b722" stackId="tok" />
              </>
            ) : (
              <Area dataKey="tokens" name="est tokens" type={tokenLine} stroke="#34d399" fill="#34d39922" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame
        title="Completer rounds / recoveries"
        empty={turnRows.every((r) => r.rounds == null && r.recoveries == null)}
        hint="no turn perf in this window — send a chat, then refresh"
      >
        <ResponsiveContainer>
          <AreaChart data={turnRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="rounds" type="monotone" stroke="#38bdf8" fill="#38bdf822" connectNulls />
            <Area dataKey="recoveries" type="monotone" stroke="#f87171" fill="#f8717122" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="MCP published vs skipped" empty={mcpRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={mcpRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="published" type="monotone" stroke="#34d399" fill="#34d39922" />
            <Area dataKey="skipped" type="monotone" stroke="#fbbf24" fill="#fbbf2422" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="Uptime (min) / restarts" empty={uptimeRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={uptimeRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="uptimeMin" type="monotone" stroke="#a78bfa" fill="#a78bfa22" />
            <Area dataKey="restarts" type="monotone" stroke="#f87171" fill="#f8717122" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
