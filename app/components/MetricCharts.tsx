"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { McpSample, StatSample, TurnSample, UptimeSample } from "@/lib/yard/types";

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChartFrame({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {empty ? <p className="py-8 text-center text-xs text-zinc-600">no samples yet — leave this page open</p> : <div className="h-40">{children}</div>}
    </div>
  );
}

export function MetricCharts({
  host,
  turns,
  mcp,
  uptime,
}: {
  host: StatSample[];
  turns: TurnSample[];
  mcp: McpSample[];
  uptime: UptimeSample[];
}) {
  const hostRows = host.map((s) => ({
    t: fmtTime(s.at),
    cpu: s.cpuPercent == null ? null : Number(s.cpuPercent.toFixed(1)),
    mem: s.memBytes == null ? null : Number((s.memBytes / 1024 / 1024).toFixed(1)),
  }));
  const turnRows = turns.map((s) => ({
    t: fmtTime(s.at),
    tokens: s.estTokens,
    rounds: s.rounds,
    recoveries: s.recoveries,
  }));
  const mcpRows = mcp.map((s) => ({
    t: fmtTime(s.at),
    published: s.published,
    skipped: s.skipped,
  }));
  const uptimeRows = uptime.map((s) => ({
    t: fmtTime(s.at),
    uptimeMin: s.uptimeSeconds == null ? null : Number((s.uptimeSeconds / 60).toFixed(1)),
    restarts: s.restartCount,
  }));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartFrame title="CPU %" empty={hostRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={hostRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={36} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
            <Area dataKey="cpu" type="monotone" stroke="#f59e0b" fill="#f59e0b33" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="Memory (MiB)" empty={hostRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={hostRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
            <Area dataKey="mem" type="monotone" stroke="#e7e5e4" fill="#e7e5e422" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="est. tokens / turn" empty={turnRows.every((r) => r.tokens == null)}>
        <ResponsiveContainer>
          <AreaChart data={turnRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={44} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
            <Area dataKey="tokens" type="monotone" stroke="#34d399" fill="#34d39922" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="Completer rounds / recoveries" empty={turnRows.every((r) => r.rounds == null && r.recoveries == null)}>
        <ResponsiveContainer>
          <AreaChart data={turnRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
            <Area dataKey="rounds" type="monotone" stroke="#38bdf8" fill="#38bdf822" />
            <Area dataKey="recoveries" type="monotone" stroke="#f87171" fill="#f8717122" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="MCP published vs skipped" empty={mcpRows.length === 0}>
        <ResponsiveContainer>
          <AreaChart data={mcpRows}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
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
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
            <Area dataKey="uptimeMin" type="monotone" stroke="#a78bfa" fill="#a78bfa22" />
            <Area dataKey="restarts" type="monotone" stroke="#f87171" fill="#f8717122" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
