"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { filterSamples, hostNetRates, thinChartPoints } from "@/lib/yard/observe/spend";
import type { HostSample } from "@/lib/yard/types";
import { ChartFrame, CHART_GRID, CHART_TICK, CHART_TOOLTIP, SERIES, wash, fmtTick, spanOf } from "../shared/ChartFrame";

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
            <CartesianGrid stroke={CHART_GRID} />
            <XAxis dataKey="t" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} width={36} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="agents" type="monotone" stackId="cpu" stroke={SERIES.accent} fill={wash(SERIES.accent)} />
            <Area dataKey="dashboard" type="monotone" stackId="cpu" stroke={SERIES.info} fill={wash(SERIES.info)} />
            <Area dataKey="other" type="monotone" stackId="cpu" stroke={SERIES.dim} fill={wash(SERIES.dim)} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="RAM (GiB)" empty={cpuRows.length === 0} caption="agents / dashboard / other in Docker">
        <ResponsiveContainer>
          <AreaChart data={cpuRows}>
            <CartesianGrid stroke={CHART_GRID} />
            <XAxis dataKey="t" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} width={36} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="agentsGiB" name="agents" type="monotone" stackId="mem" stroke={SERIES.accent} fill={wash(SERIES.accent)} />
            <Area dataKey="dashboardGiB" name="dashboard" type="monotone" stackId="mem" stroke={SERIES.info} fill={wash(SERIES.info)} />
            <Area dataKey="otherGiB" name="other" type="monotone" stackId="mem" stroke={SERIES.dim} fill={wash(SERIES.dim)} />
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
            <CartesianGrid stroke={CHART_GRID} />
            <XAxis dataKey="t" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} width={44} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="agentsRx" name="agents" type="monotone" stackId="rx" stroke={SERIES.accent} fill={wash(SERIES.accent)} />
            <Area dataKey="dashboardRx" name="dashboard" type="monotone" stackId="rx" stroke={SERIES.info} fill={wash(SERIES.info)} />
            <Area dataKey="otherRx" name="other" type="monotone" stackId="rx" stroke={SERIES.dim} fill={wash(SERIES.dim)} />
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
            <CartesianGrid stroke={CHART_GRID} />
            <XAxis dataKey="t" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} width={44} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Area dataKey="agentsTx" name="agents" type="monotone" stackId="tx" stroke={SERIES.accent} fill={wash(SERIES.accent)} />
            <Area dataKey="dashboardTx" name="dashboard" type="monotone" stackId="tx" stroke={SERIES.info} fill={wash(SERIES.info)} />
            <Area dataKey="otherTx" name="other" type="monotone" stackId="tx" stroke={SERIES.dim} fill={wash(SERIES.dim)} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
});
