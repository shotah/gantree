"use client";

import Link from "next/link";
import { fmtEstTokens } from "@/lib/yard/spend";
import type { SpendRollup, SpendSlice, YardSpend } from "@/lib/yard/types";

function Bar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(100, share * 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SliceList({ slices, max }: { slices: SpendSlice[]; max: number }) {
  if (slices.length === 0) {
    return null;
  }
  return (
    <ul className="mt-1 space-y-1">
      {slices.map((s) => (
        <li key={s.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-[11px] text-zinc-400">
          <span className="truncate font-mono text-zinc-300" title={s.id}>
            {s.id}
          </span>
          <Bar share={max > 0 ? s.estTokens / max : 0} />
          <span className="tabular-nums text-zinc-300">
            {fmtEstTokens(s.estTokens)} · {s.turns}t
          </span>
        </li>
      ))}
    </ul>
  );
}

function CraneRow({ crane, max }: { crane: SpendRollup; max: number }) {
  return (
    <li className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
      <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
        <Link href={`/gantries/${crane.slug}`} className="truncate font-medium text-stone-100 hover:text-amber-400">
          {crane.slug}
        </Link>
        <Bar share={max > 0 ? crane.estTokens / max : 0} />
        <span className="tabular-nums text-xs text-zinc-300">
          {fmtEstTokens(crane.estTokens)} · {crane.turns} turn{crane.turns === 1 ? "" : "s"}
        </span>
      </div>
      {crane.byUser.length > 0 ? (
        <div className="mt-2 pl-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">by user</p>
          <SliceList slices={crane.byUser} max={crane.estTokens} />
        </div>
      ) : crane.unattributedTurns > 0 ? (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          no user_id on turn perf yet — crane is the unit. Pin a newer ai-gantry for per-user.
        </p>
      ) : null}
      {crane.bySource.length > 1 ? (
        <div className="mt-2 pl-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">by source</p>
          <SliceList slices={crane.bySource} max={crane.estTokens} />
        </div>
      ) : null}
    </li>
  );
}

export function SpendBoard({ spend }: { spend: YardSpend | undefined }) {
  const max = spend?.cranes[0]?.estTokens ?? 0;
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Est. token spend</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-100">
            {fmtEstTokens(spend?.estTokens ?? 0)}
            <span className="ml-2 text-sm font-normal text-zinc-500">est. tokens</span>
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {spend?.turns ?? 0} turn{(spend?.turns ?? 0) === 1 ? "" : "s"}
          {spend && spend.promptEst + spend.genEst > 0
            ? ` · prompt ${fmtEstTokens(spend.promptEst)} · gen ${fmtEstTokens(spend.genEst)}`
            : ""}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        Sum of <code className="text-zinc-500">prompt_est_tokens</code> + <code className="text-zinc-500">gen_est_tokens</code>{" "}
        from <code className="text-zinc-500">turn perf</code> in docker logs (chars/4). Not billed dollars — a GCP usage pull is
        later.
      </p>
      {!spend || spend.turns === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No turn perf in docker logs yet. Chat an agent, then wait one board refresh.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {spend.cranes.map((c) => (
            <CraneRow key={c.slug} crane={c} max={max} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CraneSpend({ rollup }: { rollup: SpendRollup }) {
  if (rollup.turns === 0) {
    return (
      <p className="mb-3 text-xs text-zinc-600">
        No turn perf in docker logs yet. Estimates are chars/4, not billed $.
      </p>
    );
  }
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-600">sampled turns</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{rollup.turns}</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-600">est. prompt + gen</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">{fmtEstTokens(rollup.estTokens)}</p>
        <p className="text-[11px] text-zinc-500">
          {fmtEstTokens(rollup.promptEst)} prompt · {fmtEstTokens(rollup.genEst)} gen
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-600">
          {rollup.byUser.length > 0 ? "top user" : "source"}
        </p>
        {rollup.byUser[0] ? (
          <p className="mt-1 truncate font-mono text-sm text-zinc-200" title={rollup.byUser[0].id}>
            {rollup.byUser[0].id}
            <span className="ml-2 font-sans text-xs text-zinc-500">{fmtEstTokens(rollup.byUser[0].estTokens)}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-300">{rollup.bySource[0]?.id ?? "—"}</p>
        )}
        {rollup.byUser.length > 1 ? <SliceList slices={rollup.byUser} max={rollup.estTokens} /> : null}
        {rollup.byUser.length === 0 && rollup.unattributedTurns > 0 ? (
          <p className="mt-1 text-[11px] text-zinc-600">user_id not on slog yet</p>
        ) : null}
      </div>
    </div>
  );
}