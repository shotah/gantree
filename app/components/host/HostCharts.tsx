"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { filterSamples, hostNetRates, thinChartPoints } from "@/lib/yard/observe/spend";
import type { HostSample } from "@/lib/yard/types";
import { ChartFrame, CHART_TOOLTIP, fmtTick, spanOf } from "../shared/ChartFrame";

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
  return (
    <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2" data-shot="host-metrics">
      <ChartFrame title="CPU % of host" empty={cpuRows.length === 0} caption="Docker share stacked · leftover is the OS">
        <ResponsiveContainer>
          <AreaChart data={cpuRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
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
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="agentsTx" name="agents" type="monotone" stackId="tx" stroke="#f59e0b" fill="#f59e0b33" />
            <Area dataKey="dashboardTx" name="dashboard" type="monotone" stackId="tx" stroke="#38bdf8" fill="#38bdf833" />
            <Area dataKey="otherTx" name="other" type="monotone" stackId="tx" stroke="#71717a" fill="#71717a33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
});
