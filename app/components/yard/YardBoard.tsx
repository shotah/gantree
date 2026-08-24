"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CraneNag, GantryCard, StatSample, YardInventory } from "@/lib/yard/types";
import { DEFAULT_SPEND_WINDOW, FAT_DATA_DIR_BYTES, fmtAgo, fmtBytes, fmtEstTokens, lastDiskBytes, type SpendWindow } from "@/lib/yard/observe/spend";
import { BuildCrane } from "./BuildCrane";
import { CraneAvatar } from "../shared/CraneAvatar";
import { useDoor } from "../shared/DoorShell";
import { EventStrip } from "../shared/EventStrip";
import { TagChips, tagChipClass } from "../shared/TagChips";
import { HostCard } from "./HostCard";
import { SpendBoard } from "./SpendBoard";
import { yardFetch } from "@/app/lib/yardFetch";

function Nag({ nag }: { nag: CraneNag }) {
  const color
    = nag.kind === "dead" ? "border-danger-line bg-danger-soft text-danger" : "border-warn-line bg-warn-soft text-warn";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{nag.detail}</span>;
}

function Badge({ state }: { state: GantryCard["state"] }) {
  const on = state === "running";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${on ? "text-ok" : "text-dim"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-ok" : "bg-faint"}`} />
      {state}
    </span>
  );
}

function craneSpendLabel(yard: YardInventory, slug: string): string {
  const row = yard.spend?.cranes.find((c) => c.slug === slug);
  if (!row || row.estTokens <= 0) {
    return "—";
  }
  return `${fmtEstTokens(row.estTokens)} · ${row.turns}t`;
}

function Spark({ samples }: { samples: StatSample[] | undefined }) {
  const values = (samples ?? []).map((s) => s.cpuPercent).filter((n): n is number => n != null);
  if (values.length < 2) {
    return null;
  }
  const w = 72;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .slice(-24)
    .map((v, i, arr) => {
      const x = arr.length === 1 ? 0 : (i / (arr.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-accent" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function RecoverySpark({ n }: { n: number }) {
  if (n <= 0) {
    return null;
  }
  const bars = Math.min(n, 8);
  const w = 36;
  const h = 16;
  const gap = 2;
  const bw = (w - gap * (bars - 1)) / bars;
  return (
    <svg width={w} height={h} className="shrink-0 text-danger/80" aria-label={`${n} ${n === 1 ? "recovery" : "recoveries"}`}>
      {Array.from({ length: bars }, (_, i) => (
        <rect key={i} x={i * (bw + gap)} y={2} width={bw} height={h - 4} rx={0.5} fill="currentColor" />
      ))}
    </svg>
  );
}

function craneRecoveries(yard: YardInventory, slug: string): number {
  return yard.spend?.cranes.find((c) => c.slug === slug)?.trajectory.recoveries ?? 0;
}

export function YardBoard() {
  const { operator } = useDoor();
  const [yard, setYard] = useState<YardInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spendWindow, setSpendWindow] = useState<SpendWindow>(DEFAULT_SPEND_WINDOW);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const eventsSlug = operator?.role === "admin" || (operator?.cranes.length ?? 0) !== 1 ? undefined : operator?.cranes[0];

  const load = useCallback(() => {
    yardFetch(`/api/gantries?window=${spendWindow}`)
      .then((r) => r.json())
      .then((data: YardInventory & { error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setYard(data);
        setError(data.dockerError);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [spendWindow]);

  const dockerPending = !yard || Boolean(yard.dockerPending);
  const allTags = [...new Set((yard?.gantries ?? []).flatMap((g) => g.tags))].sort();
  const tagColors = yard?.tagColors ?? {};
  const shown = tagFilter ? (yard?.gantries ?? []).filter((g) => g.tags.includes(tagFilter)) : yard?.gantries;

  useEffect(() => {
    load();
    const id = setInterval(load, dockerPending ? 1000 : 5000);
    return () => clearInterval(id);
  }, [load, dockerPending]);

  return (
    <section className="flex min-w-0 flex-col gap-6" data-shot="yard">
      <div className="flex flex-wrap items-end justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Shipping yard</h1>
          <p className="mt-1 text-sm text-dim">
            {yard
              ? `${yard.gantries.length} crane${yard.gantries.length === 1 ? "" : "s"} · ${yard.source} · ${yard.yard}${yard.dockerPending ? " · checking Docker…" : ""}`
              : "loading…"}
          </p>
        </div>
        {yard?.canBuild ? <BuildCrane onBuilt={load} /> : null}
      </div>

      {error
        ? (
            <p className="rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-sm text-mark">{error}</p>
          )
        : null}

      {yard ? <SpendBoard spend={yard.spend} window={spendWindow} onWindow={setSpendWindow} observe={yard.observe} /> : null}

      {yard && yard.gantries.length === 0 && !yard.dockerPending
        ? (
            <div className="rounded-lg border border-dashed border-line px-5 py-8 text-sm text-muted">
              <p>
                No cranes yet. Build one from this board, or copy
                {" "}
                <code className="text-accent">gantree.toml.example</code>
                {" "}
                to
                {" "}
                <code className="text-accent">gantree.toml</code>
                .
              </p>
            </div>
          )
        : null}

      {allTags.length
        ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
              <span className="text-xs text-dim">tags</span>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tagFilter === t}
                  onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    tagFilter === t ? `${tagChipClass(tagColors[t])} ring-1 ring-fg` : tagChipClass(tagColors[t])
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )
        : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HostCard host={yard?.host} dockerError={yard?.dockerError} />
        {(shown ?? []).map((g) => (
          <Link
            key={g.slug}
            href={`/gantries/${g.slug}`}
            className="min-w-0 max-w-full rounded-lg border border-line bg-panel/60 p-4 transition hover:border-accent-line max-sm:p-5"
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h2 className="flex min-w-0 items-center gap-2 font-semibold text-fg max-sm:text-lg">
                <CraneAvatar slug={g.slug} rev={g.avatarRev} />
                <span className="truncate">{g.slug}</span>
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <Spark samples={yard?.sparks?.[g.slug]} />
                <RecoverySpark n={yard ? craneRecoveries(yard, g.slug) : 0} />
                <Badge state={g.state} />
              </div>
            </div>
            {g.tags.length ? <TagChips tags={g.tags} colors={tagColors} className="mt-2" /> : null}
            <dl className="mt-3 min-w-0 space-y-1 text-xs text-muted max-sm:space-y-1.5 max-sm:text-sm">
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">model</dt>
                <dd className="min-w-0 truncate text-fg">{g.model ?? "—"}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">channel</dt>
                <dd className="min-w-0 truncate text-fg">{g.channel ?? "—"}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">MCP</dt>
                <dd className="min-w-0 truncate text-fg">
                  {g.mcpPublished}
                  {" "}
                  published ·
                  {g.mcpSkipped}
                  {" "}
                  skipped
                </dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">est. tokens</dt>
                <dd className="min-w-0 truncate text-fg">{yard ? craneSpendLabel(yard, g.slug) : "—"}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">last turn</dt>
                <dd className="min-w-0 truncate text-fg" title={g.lastTurn ?? ""}>
                  {g.lastTurn ? fmtAgo(Date.parse(g.lastTurn)) : "—"}
                </dd>
              </div>
              {(() => {
                const disk = lastDiskBytes(yard?.sparks?.[g.slug]);
                if (disk == null || disk < FAT_DATA_DIR_BYTES) {
                  return null;
                }
                return (
                  <div className="flex min-w-0 justify-between gap-2">
                    <dt className="shrink-0">data dir</dt>
                    <dd className="min-w-0 truncate text-fg">{fmtBytes(disk)}</dd>
                  </div>
                );
              })()}
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">image</dt>
                <dd className="min-w-0 truncate text-fg" title={g.image ?? ""}>
                  {g.image ?? "—"}
                </dd>
              </div>
            </dl>
            {g.lastError ? <p className="mt-3 truncate text-xs text-danger/80">{g.lastError}</p> : null}
            {g.mcpHint ? <p className="mt-2 truncate text-xs text-dim">{g.mcpHint}</p> : null}
            {g.nags?.length
              ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.nags.map((n) => (
                      <Nag key={`${n.kind}:${n.detail}`} nag={n} />
                    ))}
                  </div>
                )
              : null}
          </Link>
        ))}
      </div>

      <EventStrip slug={eventsSlug} />
    </section>
  );
}
