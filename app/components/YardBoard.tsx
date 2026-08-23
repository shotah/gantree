"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CraneNag, GantryCard, StatSample, YardInventory } from "@/lib/yard/types";
import { fmtEstTokens, type SpendWindow } from "@/lib/yard/observe/spend";
import { BuildCrane } from "./BuildCrane";
import { CraneAvatar } from "./CraneAvatar";
import { EventStrip } from "./EventStrip";
import { SpendBoard } from "./SpendBoard";
import { yardFetch } from "../lib/yardFetch";

function Nag({ nag }: { nag: CraneNag }) {
  const color =
    nag.kind === "dead" ? "border-red-900/70 bg-red-950/40 text-red-200" : "border-amber-900/70 bg-amber-950/40 text-amber-200";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{nag.detail}</span>;
}

function Badge({ state }: { state: GantryCard["state"] }) {
  const on = state === "running";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${on ? "text-emerald-400" : "text-zinc-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-400" : "bg-zinc-600"}`} />
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
    <svg width={w} height={h} className="shrink-0 text-amber-500" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export function YardBoard() {
  const [yard, setYard] = useState<YardInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spendWindow, setSpendWindow] = useState<SpendWindow>("24h");

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

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100">Shipping yard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {yard ? `${yard.gantries.length} crane${yard.gantries.length === 1 ? "" : "s"} · ${yard.source} · ${yard.yard}` : "loading…"}
          </p>
        </div>
        <BuildCrane onBuilt={load} />
      </div>

      {error ? (
        <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">{error}</p>
      ) : null}

      {yard ? <SpendBoard spend={yard.spend} window={spendWindow} onWindow={setSpendWindow} /> : null}

      {!yard ? <p className="text-sm text-zinc-500">Talking to Docker…</p> : null}

      {yard && yard.gantries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-5 py-8 text-sm text-zinc-400">
          <p>
            No cranes yet. Build one from this board, or copy <code className="text-amber-500">gantree.toml.example</code> to{" "}
            <code className="text-amber-500">gantree.toml</code>.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {yard?.gantries.map((g) => (
          <Link
            key={g.slug}
            href={`/gantries/${g.slug}`}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-amber-800/70"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-stone-100">
                <CraneAvatar slug={g.slug} rev={g.avatarRev} />
                {g.slug}
              </h2>
              <div className="flex items-center gap-2">
                <Spark samples={yard.sparks?.[g.slug]} />
                <Badge state={g.state} />
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between gap-2">
                <dt>model</dt>
                <dd className="text-zinc-200">{g.model ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>channel</dt>
                <dd className="text-zinc-200">{g.channel ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>MCP</dt>
                <dd className="text-zinc-200">
                  {g.mcpPublished} published · {g.mcpSkipped} skipped
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>est. tokens</dt>
                <dd className="text-zinc-200">{craneSpendLabel(yard, g.slug)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>last turn</dt>
                <dd className="truncate text-zinc-200" title={g.lastTurn ?? ""}>
                  {g.lastTurn ? new Date(g.lastTurn).toLocaleTimeString() : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>image</dt>
                <dd className="truncate text-zinc-200" title={g.image ?? ""}>
                  {g.image ?? "—"}
                </dd>
              </div>
            </dl>
            {g.lastError ? <p className="mt-3 truncate text-xs text-red-300/80">{g.lastError}</p> : null}
            {g.mcpHint ? <p className="mt-2 truncate text-xs text-zinc-500">{g.mcpHint}</p> : null}
            {g.nags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {g.nags.map((n) => (
                  <Nag key={`${n.kind}:${n.detail}`} nag={n} />
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      <EventStrip />
    </section>
  );
}
