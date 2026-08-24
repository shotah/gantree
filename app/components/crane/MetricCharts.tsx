"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  filterSamples,
  fmtEstTokens,
  fmtSpendBucketTitle,
  SOURCE_ORDER,
  sourceChartSeries,
  thinChartPoints,
  tokenChartSeries,
  type SpendBucket,
} from "@/lib/yard/observe/spend";
import type { McpSample, StatSample, TurnSample, UptimeSample } from "@/lib/yard/types";
import { ChartFrame, CHART_TOOLTIP, fmtTick, mib, spanOf } from "../shared/ChartFrame";

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
    <div className="grid min-w-0 gap-3 md:grid-cols-2" data-shot="metrics">
      <ChartFrame title="CPU %" empty={hostRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={hostRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="mem" type="monotone" stroke="#e7e5e4" fill="#e7e5e422" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      {hostRows.length > 0
        ? (
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
                    <Tooltip contentStyle={CHART_TOOLTIP} />
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
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Area dataKey="blkRead" name="read" type="monotone" stroke="#fbbf24" fill="#fbbf2422" connectNulls />
                    <Area dataKey="blkWrite" name="write" type="monotone" stroke="#fb923c" fill="#fb923c22" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            </>
          )
        : null}
      {hasDisk
        ? (
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
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area dataKey="disk" name="data dir" type="monotone" stroke="#a3e635" fill="#a3e63522" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
          )
        : null}
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
            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => fmtEstTokens(typeof value === "number" ? value : 0)} />
            {hasSplit
              ? (
                  <>
                    <Area dataKey="prompt" name="prompt est" type={tokenLine} stroke="#34d399" fill="#34d39922" stackId="tok" />
                    <Area dataKey="gen" name="gen est" type={tokenLine} stroke="#6ee7b7" fill="#6ee7b722" stackId="tok" />
                  </>
                )
              : (
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="rounds" type="monotone" stroke="#38bdf8" fill="#38bdf822" connectNulls />
            <Area dataKey="recoveries" type="monotone" stroke="#f87171" fill="#f8717122" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      {hasSource
        ? (
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
                  <Tooltip contentStyle={CHART_TOOLTIP} />
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
          )
        : null}
      {hasDuration
        ? (
            <ChartFrame title="Turn duration (s)" empty={false} caption="from slog duration_ms when present">
              <ResponsiveContainer>
                <AreaChart data={turnRows}>
                  <CartesianGrid stroke="#27272a" />
                  <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area dataKey="durationS" name="seconds" type="monotone" stroke="#c084fc" fill="#c084fc22" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
          )
        : null}
      <ChartFrame title="MCP published vs skipped" empty={mcpRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={mcpRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="uptimeMin" type="monotone" stroke="#a78bfa" fill="#a78bfa22" />
            <Area dataKey="restarts" type="monotone" stroke="#f87171" fill="#f8717122" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
});
