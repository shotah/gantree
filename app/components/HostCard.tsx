"use client";

import Link from "next/link";
import { fmtAgo, fmtBps, fmtBytes, fmtCores, hostShare, lastHostNetRate } from "@/lib/yard/observe/spend";
import type { HostLive, HostRole, HostSample, HostSnapshot } from "@/lib/yard/types";

const CARD =
  "rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-amber-800/70 max-sm:p-5";

const ROLE_LABEL: Record<HostRole, string> = {
  crane: "agents",
  console: "dashboard",
  other: "other",
};

const ROLE_BAR: Record<HostRole, string> = {
  crane: "bg-amber-500",
  console: "bg-sky-400",
  other: "bg-zinc-500",
};

const ROLE_TEXT: Record<HostRole, string> = {
  crane: "text-amber-400",
  console: "text-sky-400",
  other: "text-zinc-400",
};

function Stack({
  parts,
  cap,
}: {
  parts: { role: HostRole; value: number }[];
  cap: number;
}) {
  const used = parts.reduce((n, p) => n + p.value, 0);
  const filled = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div className="flex h-full" style={{ width: `${filled}%` }}>
        {parts.map((p) => {
          const share = used > 0 ? (p.value / used) * 100 : 0;
          if (share <= 0) {
            return null;
          }
          return <div key={p.role} className={ROLE_BAR[p.role]} style={{ width: `${share}%` }} />;
        })}
      </div>
    </div>
  );
}

/** Same h-8 round bubble as crane/operator avatars — a CPU die, not a face. */
export function HostAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-zinc-800 text-amber-500`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <rect x="7" y="7" width="10" height="10" rx="1.4" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" />
        <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" />
      </svg>
    </span>
  );
}

function HostSpark({ spark }: { spark: HostSample[] }) {
  const values = spark.map((s) => {
    const cap = s.ncpu * 100;
    return cap > 0 ? ((s.craneCpu + s.consoleCpu + s.otherCpu) / cap) * 100 : 0;
  });
  if (values.length < 2) {
    return null;
  }
  const w = 72;
  const h = 20;
  const max = Math.max(1, ...values);
  const pts = values
    .slice(-24)
    .map((v, i, arr) => {
      const x = arr.length === 1 ? 0 : (i / (arr.length - 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-amber-500" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export function HostMeters({ live, spark = [] }: { live: HostSnapshot; spark?: HostSample[] }) {
  const cpuCap = live.ncpu * 100;
  const cpuUsed = live.craneCpu + live.consoleCpu + live.otherCpu;
  const memUsed = live.craneMem + live.consoleMem + live.otherMem;
  const netRx = live.craneRx + live.consoleRx + live.otherRx;
  const netTx = live.craneTx + live.consoleTx + live.otherTx;
  const rate = lastHostNetRate(spark.length > 0 ? spark : [live]);
  const rxBps = rate ? rate.craneRx + rate.consoleRx + rate.otherRx : 0;
  const txBps = rate ? rate.craneTx + rate.consoleTx + rate.otherTx : 0;
  const cpuParts = [
    { role: "crane" as const, value: live.craneCpu },
    { role: "console" as const, value: live.consoleCpu },
    { role: "other" as const, value: live.otherCpu },
  ];
  const memParts = [
    { role: "crane" as const, value: live.craneMem },
    { role: "console" as const, value: live.consoleMem },
    { role: "other" as const, value: live.otherMem },
  ];
  const netParts = [
    { role: "crane" as const, value: rate ? rate.craneRx + rate.craneTx : live.craneRx + live.craneTx },
    { role: "console" as const, value: rate ? rate.consoleRx + rate.consoleTx : live.consoleRx + live.consoleTx },
    { role: "other" as const, value: rate ? rate.otherRx + rate.otherTx : live.otherRx + live.otherTx },
  ];
  const top = [...live.procs].slice(0, 6);

  return (
    <>
      <dl className="mt-3 space-y-2 text-xs text-zinc-400 max-sm:text-sm">
        <div>
          <div className="mb-1 flex justify-between gap-2">
            <dt>CPU</dt>
            <dd className="tabular-nums text-zinc-200">
              {fmtCores(cpuUsed)} / {live.ncpu} cores · {Math.round(hostShare(cpuUsed, cpuCap) * 100)}%
            </dd>
          </div>
          <Stack parts={cpuParts} cap={cpuCap} />
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2">
            <dt>RAM</dt>
            <dd className="tabular-nums text-zinc-200">
              {fmtBytes(memUsed)} / {fmtBytes(live.memTotalBytes)} · {Math.round(hostShare(memUsed, live.memTotalBytes) * 100)}%
            </dd>
          </div>
          <Stack parts={memParts} cap={live.memTotalBytes} />
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2">
            <dt>NET</dt>
            <dd className="tabular-nums text-zinc-200">
              ↓ {fmtBps(rxBps)} · ↑ {fmtBps(txBps)}
            </dd>
          </div>
          <Stack parts={netParts} cap={netParts.reduce((n, p) => n + p.value, 0)} />
          <p className="mt-1 tabular-nums text-[10px] text-zinc-600">
            {fmtBytes(netRx)} ↓ · {fmtBytes(netTx)} ↑ since those containers started
          </p>
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <dt className={ROLE_TEXT.crane}>agents</dt>
          <dd className="tabular-nums text-zinc-200">
            {fmtCores(live.craneCpu)}c · {fmtBytes(live.craneMem)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className={ROLE_TEXT.console}>dashboard</dt>
          <dd className="tabular-nums text-zinc-200">
            {fmtCores(live.consoleCpu)}c · {fmtBytes(live.consoleMem)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className={ROLE_TEXT.other}>other</dt>
          <dd className="tabular-nums text-zinc-200">
            {fmtCores(live.otherCpu)}c · {fmtBytes(live.otherMem)}
          </dd>
        </div>
      </dl>

      {top.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-800/80 pt-2">
          {top.map((p) => (
            <li key={p.name} className="flex justify-between gap-2 text-[11px] text-zinc-500">
              <span className="truncate">
                <span className={ROLE_TEXT[p.role]}>{ROLE_LABEL[p.role]}</span>{" "}
                <span className="font-mono text-zinc-400">{p.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-zinc-400">
                {fmtCores(p.cpuPercent ?? 0)}c · {fmtBytes(p.memBytes ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[10px] text-zinc-600">
        Docker share of the Mini · {fmtAgo(live.at)} · leftover is the OS, the host NIC, and anything not in a container
      </p>
    </>
  );
}

export function HostCard({ host, dockerError }: { host: HostLive | undefined; dockerError?: string | null }) {
  const live = host?.live;
  const spark = host?.spark ?? [];
  if (!live) {
    return (
      <Link href="/host" className={CARD} data-shot="host">
        <h2 className="flex items-center gap-2 font-semibold text-stone-100">
          <HostAvatar />
          Host
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          {dockerError || "Sampling Docker for host CPU, RAM, and net…"}
        </p>
      </Link>
    );
  }

  return (
    <Link href="/host" className={CARD} data-shot="host">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-stone-100 max-sm:text-lg">
          <HostAvatar />
          {live.hostname}
        </h2>
        <div className="flex items-center gap-2">
          <HostSpark spark={spark} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            docker
          </span>
        </div>
      </div>
      <HostMeters live={live} spark={spark} />
    </Link>
  );
}
