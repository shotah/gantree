"use client";

import Link from "next/link";
import { useState } from "react";
import {
  estSpendUsd,
  fmtAgo,
  fmtEstTokens,
  fmtSpendWindow,
  fmtUsd,
  orderedSources,
  spendPace,
  SPEND_WINDOWS,
  type SpendBucket,
  type SpendWindow,
} from "@/lib/yard/observe/spend";
import type { LastTurn, ObservePrefs, SpendRollup, SpendSlice, YardSpend } from "@/lib/yard/types";

const WINDOW_LABELS: Record<SpendWindow, string> = {
  "1h": "1h",
  "6h": "6h",
  "12h": "12h",
  "24h": "24h",
  "7d": "7d",
  month: "month",
  all: "all",
};

const BUCKET_LABELS: Record<SpendBucket, string> = {
  cumulative: "total",
  hour: "/h",
  "6h": "/6h",
  "12h": "/12h",
  day: "/d",
};

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded border px-2 py-0.5 text-[11px] max-sm:min-h-11 max-sm:w-full max-sm:text-xs ${
        active ? "border-accent-line text-accent-hover" : "border-line text-dim hover:border-muted hover:text-body"
      }`}
    >
      {children}
    </button>
  );
}

export function SpendScope({
  window,
  onWindow,
  bucket,
  onBucket,
  buckets,
}: {
  window: SpendWindow;
  onWindow: (w: SpendWindow) => void;
  bucket?: SpendBucket;
  onBucket?: (b: SpendBucket) => void;
  buckets?: SpendBucket[];
}) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-1.5 max-sm:w-full max-sm:items-stretch">
      <div className="flex min-w-0 flex-wrap justify-end gap-1 max-sm:grid max-sm:grid-cols-[repeat(auto-fit,minmax(4.25rem,1fr))]" role="group" aria-label="Time window">
        {SPEND_WINDOWS.map((w) => (
          <Pill key={w} active={window === w} onClick={() => onWindow(w)}>
            {WINDOW_LABELS[w]}
          </Pill>
        ))}
      </div>
      {onBucket && buckets && buckets.length > 0
        ? (
            <div className="flex min-w-0 flex-wrap justify-end gap-1 max-sm:grid max-sm:grid-cols-[repeat(auto-fit,minmax(4.25rem,1fr))]" role="group" aria-label="Token grouping">
              {buckets.map((b) => (
                <Pill key={b} active={bucket === b} onClick={() => onBucket(b)}>
                  {BUCKET_LABELS[b]}
                </Pill>
              ))}
            </div>
          )
        : null}
    </div>
  );
}

function Bar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(100, share * 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-track">
      <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}

const SOURCE_BAR: Record<string, string> = {
  user: "bg-ok",
  cron: "bg-accent",
  watch: "bg-info",
  reaction: "bg-reaction",
  unknown: "bg-faint",
};

function MixBar({ slices, total }: { slices: SpendSlice[]; total: number }) {
  if (total <= 0 || slices.length === 0) {
    return null;
  }
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-track" aria-hidden>
      {orderedSources(slices).map((s) => {
        const share = (s.estTokens / total) * 100;
        if (share <= 0) {
          return null;
        }
        return <div key={s.id} className={SOURCE_BAR[s.id] ?? SOURCE_BAR.unknown} style={{ width: `${share}%` }} />;
      })}
    </div>
  );
}

function MixLegend({ slices }: { slices: SpendSlice[] }) {
  if (slices.length === 0) {
    return null;
  }
  return (
    <p className="mt-1 text-[11px] text-dim">
      {orderedSources(slices)
        .map((s) => `${s.id} ${fmtEstTokens(s.estTokens)}`)
        .join(" · ")}
    </p>
  );
}

function lastTurnLine(turn: LastTurn | null | undefined, now: number): string | null {
  if (!turn) {
    return null;
  }
  const bits = [fmtAgo(turn.at, now), turn.source || "turn", turn.outcome || "ok", fmtEstTokens(turn.estTokens)];
  if (turn.rounds != null) {
    bits.push(`${turn.rounds} round${turn.rounds === 1 ? "" : "s"}`);
  }
  return bits.join(" · ");
}

function SliceList({ slices, max }: { slices: SpendSlice[]; max: number }) {
  if (slices.length === 0) {
    return null;
  }
  return (
    <ul className="mt-1 space-y-1">
      {slices.map((s) => (
        <li key={s.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-[11px] text-muted max-sm:grid-cols-[1fr_auto] max-sm:gap-x-2 max-sm:gap-y-1">
          <span className="truncate font-mono text-body max-sm:col-span-2" title={s.id}>
            {s.label || s.id}
          </span>
          <Bar share={max > 0 ? s.estTokens / max : 0} />
          <span className="tabular-nums text-body">
            {fmtEstTokens(s.estTokens)} · {s.turns}t
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExtraUsers({ slices, max }: { slices: SpendSlice[]; max: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 text-left text-[10px] uppercase tracking-wide text-faint hover:text-muted"
      >
        {open ? "▾" : "▸"}
        {" "}
        {slices.length}
        {" "}
        users
      </button>
      {open ? <SliceList slices={slices} max={max} /> : null}
    </>
  );
}

function CraneRow({ crane, max }: { crane: SpendRollup; max: number }) {
  const [open, setOpen] = useState(false);
  const hasUsers = crane.byUser.length > 0;
  const hasSources = crane.bySource.length > 1;
  const canOpen = hasUsers || hasSources || crane.unattributedTurns > 0;
  const summary = hasUsers
    ? `${crane.byUser.length} user${crane.byUser.length === 1 ? "" : "s"}`
    : hasSources
      ? `${crane.bySource.length} sources`
      : "detail";

  return (
    <li className="min-w-0 rounded-md border border-line/80 bg-canvas/40 px-3 py-2">
      <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm max-sm:grid-cols-1 max-sm:gap-1">
        <Link href={`/gantries/${crane.slug}`} className="truncate font-medium text-fg hover:text-accent-hover">
          {crane.slug}
        </Link>
        <Bar share={max > 0 ? crane.estTokens / max : 0} />
        <span className="tabular-nums text-xs text-body">
          {fmtEstTokens(crane.estTokens)} · {crane.turns} turn{crane.turns === 1 ? "" : "s"}
        </span>
      </div>
      {canOpen
        ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="mt-2 text-left text-[10px] uppercase tracking-wide text-faint hover:text-muted"
            >
              {open ? "▾" : "▸"}
              {" "}
              {summary}
            </button>
          )
        : null}
      {open
        ? (
            <>
              {hasUsers
                ? (
                    <div className="mt-2 pl-1">
                      <p className="text-[10px] uppercase tracking-wide text-faint">by user</p>
                      <SliceList slices={crane.byUser} max={crane.estTokens} />
                    </div>
                  )
                : crane.unattributedTurns > 0
                  ? (
                      <p className="mt-1.5 text-[11px] text-faint">
                        no user_id on turn perf yet — crane is the unit. Pin a newer ai-gantry for per-user.
                      </p>
                    )
                  : null}
              {hasSources
                ? (
                    <div className="mt-2 pl-1">
                      <p className="text-[10px] uppercase tracking-wide text-faint">by source</p>
                      <SliceList slices={crane.bySource} max={crane.estTokens} />
                    </div>
                  )
                : null}
            </>
          )
        : null}
    </li>
  );
}

export function SpendBoard({
  spend,
  window,
  onWindow,
  observe,
}: {
  spend: YardSpend | undefined;
  window: SpendWindow;
  onWindow: (w: SpendWindow) => void;
  observe?: ObservePrefs | null;
}) {
  const [open, setOpen] = useState(false);
  const max = spend?.cranes[0]?.estTokens ?? 0;
  const craneCount = spend?.cranes.length ?? 0;
  const empty = !spend || spend.turns === 0;
  const scope = fmtSpendWindow(window);
  const now = Date.now();
  const pace = spend && spend.estTokens > 0 ? spendPace(spend.estTokens, window, now) : null;
  const last = lastTurnLine(spend?.lastTurn, now);
  const mix = spend?.bySource ?? [];
  const usd = estSpendUsd(spend?.promptEst ?? 0, spend?.genEst ?? 0, observe);

  return (
    <section className="min-w-0 max-w-full rounded-lg border border-line bg-panel/60 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="flex flex-wrap items-end justify-between gap-3">
            <span className="flex items-start gap-2">
              <span className="mt-0.5 text-xs text-dim" aria-hidden>
                {open ? "▾" : "▸"}
              </span>
              <span>
                <span className="block text-xs font-medium uppercase tracking-wide text-dim">
                  Est. token spend ·
                  {" "}
                  {scope}
                </span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums text-fg">
                  {fmtEstTokens(spend?.estTokens ?? 0)}
                  <span className="ml-2 text-sm font-normal text-dim">est. tokens</span>
                  {usd != null ? <span className="ml-2 text-sm font-normal text-ok/90">{fmtUsd(usd)}</span> : null}
                </span>
              </span>
            </span>
            <span className="text-xs text-dim">
              {spend?.turns ?? 0} turn{(spend?.turns ?? 0) === 1 ? "" : "s"}
              {spend && spend.promptEst + spend.genEst > 0
                ? ` · prompt ${fmtEstTokens(spend.promptEst)} · gen ${fmtEstTokens(spend.genEst)}`
                : ""}
            </span>
          </span>
          {!open
            ? (
                <span className="mt-2 block pl-5 text-[11px] text-faint">
                  {empty
                    ? `No turn perf in ${scope} — expand for detail`
                    : `${craneCount} crane${craneCount === 1 ? "" : "s"} — expand for ranking`}
                  {pace
                    ? (
                        <span className="mt-1 block text-dim">
                          {fmtEstTokens(pace.perDay)}
                          {" "}
                          / day
                          {pace.projected != null ? ` · on pace for ${fmtEstTokens(pace.projected)}` : ""}
                        </span>
                      )
                    : null}
                  {mix.length > 0
                    ? (
                        <span className="mt-1.5 block">
                          <MixBar slices={mix} total={spend?.estTokens ?? 0} />
                          <MixLegend slices={mix} />
                        </span>
                      )
                    : null}
                  {last
                    ? (
                        <span className="mt-1 block">
                          last {last}
                        </span>
                      )
                    : null}
                </span>
              )
            : null}
        </button>
        <SpendScope window={window} onWindow={onWindow} />
      </div>
      {open
        ? (
            <>
              <p className="mt-2 text-[11px] text-faint">
                Sum of
                {" "}
                <code className="text-dim">prompt_est_tokens</code>
                {" "}
                +
                {" "}
                <code className="text-dim">gen_est_tokens</code>
                {" "}
                in this window from
                {" "}
                <code className="text-dim">turn perf</code>
                {" "}
                (chars/4). Each finished call adds; idle does not.
                Not billed dollars — a GCP usage pull is later.
              </p>
              {mix.length > 0
                ? (
                    <div className="mt-2">
                      <MixBar slices={mix} total={spend?.estTokens ?? 0} />
                      <MixLegend slices={mix} />
                    </div>
                  )
                : null}
              {pace
                ? (
                    <p className="mt-1 text-[11px] text-dim">
                      {fmtEstTokens(pace.perDay)}
                      {" "}
                      / day
                      {pace.projected != null ? ` · on pace for ${fmtEstTokens(pace.projected)} this month` : ""}
                    </p>
                  )
                : null}
              {empty || !spend
                ? (
                    <p className="mt-3 text-sm text-dim">
                      No turn perf in
                      {" "}
                      {scope}
                      . Chat an agent, then wait one board refresh — or widen the window.
                    </p>
                  )
                : (
                    <ul className="mt-3 space-y-2">
                      {spend.cranes.map((c) => (
                        <CraneRow key={c.slug} crane={c} max={max} />
                      ))}
                    </ul>
                  )}
            </>
          )
        : null}
    </section>
  );
}

export function CraneSpend({ rollup, scope, observe }: { rollup: SpendRollup; scope: string; observe?: ObservePrefs | null }) {
  if (rollup.turns === 0) {
    return (
      <p className="mb-3 text-xs text-faint">
        No turn perf in
        {" "}
        {scope}
        . Estimates are chars/4, not billed $.
      </p>
    );
  }
  const last = lastTurnLine(rollup.lastTurn, Date.now());
  const usd = estSpendUsd(rollup.promptEst, rollup.genEst, observe);
  return (
    <div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-faint">
          sampled turns · {scope}
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{rollup.turns}</p>
        {last
          ? (
              <p className="mt-1 text-[11px] text-dim">
                last {last}
              </p>
            )
          : null}
      </div>
      <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-faint">est. prompt + gen</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-ok">{fmtEstTokens(rollup.estTokens)}</p>
        <p className="text-[11px] text-dim">
          {fmtEstTokens(rollup.promptEst)} prompt · {fmtEstTokens(rollup.genEst)} gen
          {usd != null ? ` · ${fmtUsd(usd)}` : ""}
        </p>
      </div>
      <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-faint">
          {rollup.byUser.length > 0 ? "top user" : "source"}
        </p>
        {rollup.byUser[0]
          ? (
              <p className="mt-1 truncate font-mono text-sm text-fg" title={rollup.byUser[0].id}>
                {rollup.byUser[0].label || rollup.byUser[0].id}
                <span className="ml-2 font-sans text-xs text-dim">{fmtEstTokens(rollup.byUser[0].estTokens)}</span>
              </p>
            )
          : (
              <p className="mt-1 text-sm text-body">{rollup.bySource[0]?.id ?? "—"}</p>
            )}
        {rollup.byUser.length > 1 ? <ExtraUsers slices={rollup.byUser} max={rollup.estTokens} /> : null}
        {rollup.byUser.length === 0 && rollup.unattributedTurns > 0
          ? (
              <p className="mt-1 text-[11px] text-faint">user_id not on slog yet</p>
            )
          : null}
      </div>
      {rollup.bySource.length > 0
        ? (
            <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-faint">source mix</p>
              <div className="mt-2">
                <MixBar slices={rollup.bySource} total={rollup.estTokens} />
                <MixLegend slices={rollup.bySource} />
              </div>
            </div>
          )
        : null}
      <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-faint">trajectory</p>
        <p className="mt-1 text-sm text-fg">
          {rollup.trajectory.medianRounds != null
            ? `median ${rollup.trajectory.medianRounds === Math.round(rollup.trajectory.medianRounds) ? rollup.trajectory.medianRounds : rollup.trajectory.medianRounds.toFixed(1)} rounds`
            : "rounds n/a"}
          {rollup.trajectory.recoveries > 0
            ? ` · ${rollup.trajectory.recoveries} ${rollup.trajectory.recoveries === 1 ? "recovery" : "recoveries"}`
            : ""}
        </p>
        {rollup.trajectory.byOutcome.length > 0
          ? (
              <p className="mt-1 text-[11px] text-dim">
                {rollup.trajectory.byOutcome.map((o) => `${o.id} ${o.turns}`).join(" · ")}
              </p>
            )
          : null}
      </div>
      <div className="min-w-0 rounded-lg border border-line bg-panel/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-faint">per human turn</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-fg">
          {rollup.trajectory.userTurns > 0
            ? fmtEstTokens(rollup.trajectory.userEst / rollup.trajectory.userTurns)
            : "—"}
        </p>
        <p className="text-[11px] text-dim">
          {rollup.trajectory.userTurns}
          {" "}
          user turn
          {rollup.trajectory.userTurns === 1 ? "" : "s"}
          {rollup.estTokens - rollup.trajectory.userEst > 0
            ? ` · background ${fmtEstTokens(rollup.estTokens - rollup.trajectory.userEst)}`
            : ""}
        </p>
      </div>
    </div>
  );
}
