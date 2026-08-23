"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  filterSamples,
  fmtEstTokens,
  fmtSpendBucketTitle,
  hostNetRates,
  SOURCE_ORDER,
  sourceChartSeries,
  thinChartPoints,
  tokenChartSeries,
  type SpendBucket,
} from "@/lib/yard/observe/spend";
import type { HostSample, McpSample, StatSample, TurnSample, UptimeSample } from "@/lib/yard/types";
import { WhenVisible } from "./WhenVisible";

function fmtTick(at: number, spanMs: number, bucket: SpendBucket, timeZone?: string | null): string {
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

function spanOf(rows: { at: number }[]): number {
  if (rows.length < 2) {
    return 0;
  }
  return rows[rows.length - 1].at - rows[0].at;
}

function mib(bytes: number | null | undefined): number | null {
  if (bytes == null) {
    return null;
  }
  return Number((bytes / 1024 / 1024).toFixed(2));
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
          <div className="h-40 max-sm:h-52">
            <WhenVisible>{children}</WhenVisible>
          </div>
          {caption ? <p className="mt-1.5 text-[10px] text-zinc-600">{caption}</p> : null}
        </>
      )}
    </div>
  );
}

export const MetricCharts = memo(function MetricCharts({
  host,
  turns,
  mcp,
  uptime,
  bucket,
  since,
  now,
  timeZone,
}: {
  host: StatSample[];
  turns: TurnSample[];
  mcp: McpSample[];
  uptime: UptimeSample[];
  bucket: SpendBucket;
  since: number | null;
  now: number;
  timeZone?: string | null;
}) {
  const hostIn = filterSamples(host, since, now);
  const turnsIn = filterSamples(turns, since, now);
  const mcpIn = filterSamples(mcp, since, now);
  const uptimeIn = filterSamples(uptime, since, now);
  const tokenPts = tokenChartSeries(turns, { bucket, since, now });
  const sourcePts = sourceChartSeries(turns, { bucket, since, now });
  const hostSpan = spanOf(hostIn);
  const turnSpan = spanOf(turnsIn);
  const tokenSpan = spanOf(tokenPts);
  const mcpSpan = spanOf(mcpIn);
  const uptimeSpan = spanOf(uptimeIn);
  const hostRows = thinChartPoints(hostIn).map((s) => ({
    t: fmtTick(s.at, hostSpan, "hour", timeZone),
    cpu: s.cpuPercent == null ? null : Number(s.cpuPercent.toFixed(1)),
    mem: s.memBytes == null ? null : Number((s.memBytes / 1024 / 1024).toFixed(1)),
    rx: mib(s.netRxBytes),
    tx: mib(s.netTxBytes),
    blkRead: mib(s.blkReadBytes),
    blkWrite: mib(s.blkWriteBytes),
    disk: mib(s.diskBytes),
  }));
  const tokenRows = thinChartPoints(tokenPts).map((s) => ({
    t: fmtTick(s.at, tokenSpan, bucket, timeZone),
    tokens: s.tokens,
    prompt: s.prompt,
    gen: s.gen,
  }));
  const sourceSpan = spanOf(sourcePts);
  const sourceRows = thinChartPoints(sourcePts).map((s) => ({
    t: fmtTick(s.at, sourceSpan, bucket, timeZone),
    user: s.user,
    cron: s.cron,
    watch: s.watch,
    reaction: s.reaction,
    unknown: s.unknown,
  }));
  const turnRows = thinChartPoints([...turnsIn].sort((a, b) => a.at - b.at)).map((s) => ({
    t: fmtTick(s.at, turnSpan, bucket, timeZone),
    rounds: s.rounds,
    recoveries: s.recoveries,
    durationS: s.durationMs == null ? null : Number((s.durationMs / 1000).toFixed(2)),
  }));
  const mcpRows = thinChartPoints(mcpIn).map((s) => ({
    t: fmtTick(s.at, mcpSpan, "hour", timeZone),
    published: s.published,
    skipped: s.skipped,
  }));
  const uptimeRows = thinChartPoints(uptimeIn).map((s) => ({
    t: fmtTick(s.at, uptimeSpan, "hour", timeZone),
    uptimeMin: s.uptimeSeconds == null ? null : Number((s.uptimeSeconds / 60).toFixed(1)),
    restarts: s.restartCount,
  }));
  const tooltip = { background: "#18181b", border: "1px solid #3f3f46" };
  const hasSplit = tokenPts.some((r) => r.prompt > 0 || r.gen > 0);
  const tokenLine = bucket === "cumulative" ? "stepAfter" : "monotone";
  const hasNet = hostIn.some((s) => s.netRxBytes != null || s.netTxBytes != null);
  const hasBlk = hostIn.some((s) => s.blkReadBytes != null || s.blkWriteBytes != null);
  const hasDisk = hostIn.some((s) => s.diskBytes != null);
  const hasDuration = turnsIn.some((t) => t.durationMs != null);
  const hasSource = turnsIn.some((t) => t.source);
  const sourceKeys = SOURCE_ORDER.filter((k) => sourceRows.some((r) => r[k] > 0));
  const sourceStroke: Record<(typeof SOURCE_ORDER)[number], string> = {
    user: "#34d399",
    cron: "#f59e0b",
    watch: "#38bdf8",
    reaction: "#a78bfa",
    unknown: "#71717a",
  };

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
      <ChartFrame
        title="Memory (MiB)"
        empty={hostRows.length === 0}
        caption="cgroup RSS: gantry + MCP children, not the image. A fat thread is tokens; extra grants stay until you revoke."
      >
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
      {hostRows.length > 0 ? (
        <>
          <ChartFrame
            title="Network (MiB since start)"
            empty={!hasNet}
            hint="Docker omitted network counters"
            caption="cumulative rx/tx · resets when the container is recreated"
          >
            <ResponsiveContainer>
              <AreaChart data={hostRows}>
                <CartesianGrid stroke="#27272a" />
                <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
                <Tooltip contentStyle={tooltip} />
                <Area dataKey="rx" name="rx" type="monotone" stroke="#38bdf8" fill="#38bdf822" connectNulls />
                <Area dataKey="tx" name="tx" type="monotone" stroke="#818cf8" fill="#818cf822" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame
            title="Disk I/O (MiB since start)"
            empty={!hasBlk}
            hint="Docker omitted blkio counters"
            caption="cumulative read/write · resets when the container is recreated"
          >
            <ResponsiveContainer>
              <AreaChart data={hostRows}>
                <CartesianGrid stroke="#27272a" />
                <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
                <Tooltip contentStyle={tooltip} />
                <Area dataKey="blkRead" name="read" type="monotone" stroke="#fbbf24" fill="#fbbf2422" connectNulls />
                <Area dataKey="blkWrite" name="write" type="monotone" stroke="#fb923c" fill="#fb923c22" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </>
      ) : null}
      {hasDisk ? (
        <ChartFrame
          title="Data dir (MiB)"
          empty={false}
          caption="du of data_dir · every few minutes, not per board load"
        >
          <ResponsiveContainer>
            <AreaChart data={hostRows}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
              <Tooltip contentStyle={tooltip} />
              <Area dataKey="disk" name="data dir" type="monotone" stroke="#a3e635" fill="#a3e63522" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      ) : null}
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
      {hasSource ? (
        <ChartFrame
          title="Turns by source"
          empty={sourceRows.length === 0}
          caption="user / cron / watch / reaction · from slog source"
        >
          <ResponsiveContainer>
            <AreaChart data={sourceRows}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
              <Tooltip contentStyle={tooltip} />
              {sourceKeys.map((k) => (
                <Area
                  key={k}
                  dataKey={k}
                  name={k}
                  type={tokenLine}
                  stroke={sourceStroke[k]}
                  fill={`${sourceStroke[k]}22`}
                  stackId="src"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      ) : null}
      {hasDuration ? (
        <ChartFrame title="Turn duration (s)" empty={false} caption="from slog duration_ms when present">
          <ResponsiveContainer>
            <AreaChart data={turnRows}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
              <Tooltip contentStyle={tooltip} />
              <Area dataKey="durationS" name="seconds" type="monotone" stroke="#c084fc" fill="#c084fc22" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      ) : null}
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
});

export const HostCharts = memo(function HostCharts({
  spark,
  since,
  now,
  timeZone,
}: {
  spark: HostSample[];
  since: number | null;
  now: number;
  timeZone?: string | null;
}) {
  const sparkIn = filterSamples(spark, since, now);
  const sparkSpan = spanOf(sparkIn);
  const cpuRows = thinChartPoints(sparkIn).map((s) => {
    const cap = s.ncpu * 100;
    const span = cap > 0 ? cap : 1;
    return {
      t: fmtTick(s.at, sparkSpan, "hour", timeZone),
      agents: Number(((s.craneCpu / span) * 100).toFixed(2)),
      dashboard: Number(((s.consoleCpu / span) * 100).toFixed(2)),
      other: Number(((s.otherCpu / span) * 100).toFixed(2)),
      agentsGiB: Number((s.craneMem / 1024 ** 3).toFixed(3)),
      dashboardGiB: Number((s.consoleMem / 1024 ** 3).toFixed(3)),
      otherGiB: Number((s.otherMem / 1024 ** 3).toFixed(3)),
    };
  });
  const kib = (n: number) => Number((n / 1024).toFixed(2));
  const netRates = filterSamples(hostNetRates(spark), since, now);
  const netRows = thinChartPoints(netRates).map((s) => ({
    t: fmtTick(s.at, spanOf(netRates), "hour", timeZone),
    agentsRx: kib(s.craneRx),
    dashboardRx: kib(s.consoleRx),
    otherRx: kib(s.otherRx),
    agentsTx: kib(s.craneTx),
    dashboardTx: kib(s.consoleTx),
    otherTx: kib(s.otherTx),
  }));
  const hasRate = spark.length >= 2;
  const tooltip = { background: "#18181b", border: "1px solid #3f3f46" };
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2" data-shot="host-metrics">
      <ChartFrame title="CPU % of host" empty={cpuRows.length === 0} caption="Docker share stacked · leftover is the OS">
        <ResponsiveContainer>
          <AreaChart data={cpuRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="agents" type="monotone" stackId="cpu" stroke="#f59e0b" fill="#f59e0b33" />
            <Area dataKey="dashboard" type="monotone" stackId="cpu" stroke="#38bdf8" fill="#38bdf833" />
            <Area dataKey="other" type="monotone" stackId="cpu" stroke="#71717a" fill="#71717a33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="RAM (GiB)" empty={cpuRows.length === 0} caption="agents / dashboard / other in Docker">
        <ResponsiveContainer>
          <AreaChart data={cpuRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="agentsGiB" name="agents" type="monotone" stackId="mem" stroke="#f59e0b" fill="#f59e0b33" />
            <Area dataKey="dashboardGiB" name="dashboard" type="monotone" stackId="mem" stroke="#38bdf8" fill="#38bdf833" />
            <Area dataKey="otherGiB" name="other" type="monotone" stackId="mem" stroke="#71717a" fill="#71717a33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame
        title="Network rx (KiB/s)"
        empty={!hasRate}
        hint="need two samples for a rate — leave this page open"
        caption="Docker rx stacked · leftover is the host NIC"
      >
        <ResponsiveContainer>
          <AreaChart data={netRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="agentsRx" name="agents" type="monotone" stackId="rx" stroke="#f59e0b" fill="#f59e0b33" />
            <Area dataKey="dashboardRx" name="dashboard" type="monotone" stackId="rx" stroke="#38bdf8" fill="#38bdf833" />
            <Area dataKey="otherRx" name="other" type="monotone" stackId="rx" stroke="#71717a" fill="#71717a33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame
        title="Network tx (KiB/s)"
        empty={!hasRate}
        hint="need two samples for a rate — leave this page open"
        caption="Docker tx stacked · Telegram and LLM calls show up here"
      >
        <ResponsiveContainer>
          <AreaChart data={netRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
            <Tooltip contentStyle={tooltip} />
            <Area dataKey="agentsTx" name="agents" type="monotone" stackId="tx" stroke="#f59e0b" fill="#f59e0b33" />
            <Area dataKey="dashboardTx" name="dashboard" type="monotone" stackId="tx" stroke="#38bdf8" fill="#38bdf833" />
            <Area dataKey="otherTx" name="other" type="monotone" stackId="tx" stroke="#71717a" fill="#71717a33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
});

