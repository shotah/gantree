"use client";

import Link from "next/link";
import { lazy, Suspense } from "react";
import { HINTS } from "@/lib/yard/hints";
import { fmtSpendWindow, labelRollup, rollupTurns } from "@/lib/yard/observe/spend";
import { CraneAvatar } from "../shared/CraneAvatar";
import { craneFoldKey, DashFold } from "../shared/DashFold";
import { DoctorPanel } from "./DoctorPanel";
import { EventStrip } from "../shared/EventStrip";
import { InjectUserModal } from "./InjectUserModal";
import { LogViewer } from "./LogViewer";
import { CraneSpend, SpendScope } from "../yard/SpendBoard";
import { TelegramBot } from "./TelegramBot";
import { ChartSkeleton } from "../shared/WhenVisible";
import { YardModal } from "../shared/YardModal";
import { PersonaFold } from "./PersonaFold";
import { PhotoFold } from "./PhotoFold";
import { PinFold } from "./PinFold";
import { SecretsFold } from "./SecretsFold";
import { ToolsFold } from "./ToolsFold";
import { useAgentDashboard } from "./useAgentDashboard";

const MetricCharts = lazy(() => import("./MetricCharts").then((m) => ({ default: m.MetricCharts })));

export function AgentDashboard({ slug }: { slug: string }) {
  const dash = useAgentDashboard(slug);
  const {
    gantry,
    denied,
    doctor,
    host,
    turns,
    mcp,
    uptime,
    userNames,
    observe,
    notice,
    busy,
    envRecreateOpen,
    setEnvRecreateOpen,
    destroyOpen,
    setDestroyOpen,
    destroyFiles,
    setDestroyFiles,
    injectOpen,
    setInjectOpen,
    persona,
    setPersona,
    setNotice,
    spendWindow,
    setSpendWindow,
    setSpendBucket,
    now,
    refresh,
    destroy,
    act,
    mutate,
    telegramOn,
    since,
    allowedBuckets,
    bucket,
    turnsInWindow,
    setBusy,
  } = dash;

  if (denied) {
    return (
      <section className="flex flex-col gap-3">
        <Link href="/" className="text-xs text-zinc-500 hover:text-amber-500 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:text-sm">
          ← shipping yard
        </Link>
        <p className="text-sm text-amber-200">No crane here, or it is not in your access.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="flex items-start gap-3">
          <CraneAvatar slug={slug} rev={gantry?.avatarRev ?? null} size="lg" />
          <div>
            <Link href="/" className="text-xs text-zinc-500 hover:text-amber-500 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:text-sm">
              ← shipping yard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{slug}</h1>
            <p className="text-sm text-zinc-500 max-sm:break-words">
              {gantry ? `${gantry.state} · ${gantry.model ?? "no model"} · ${gantry.channel ?? "no channel"}` : "loading…"}
            </p>
          </div>
        </div>
        {mutate
          ? (
              <div className="flex flex-wrap gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
                {(["start", "stop", "recreate", "backup"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy}
                    onClick={() => act(a)}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs capitalize text-stone-200 hover:border-amber-700 disabled:opacity-50 max-sm:text-sm"
                  >
                    {a}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDestroyFiles(false);
                    setDestroyOpen(true);
                  }}
                  className="rounded border border-red-900/70 px-3 py-1.5 text-xs capitalize text-red-200 hover:border-red-600 disabled:opacity-50 max-sm:text-sm"
                >
                  destroy
                </button>
              </div>
            )
          : null}
      </div>

      {!mutate
        ? (
            <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
              read only — you can look, not grant or recreate.
            </p>
          )
        : null}

      {notice ? <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{notice}</p> : null}

      <PhotoFold dash={dash} />

      {telegramOn
        ? (
            <TelegramBot
              slug={slug}
              busy={busy}
              setBusy={setBusy}
              onNotice={setNotice}
              onSaved={refresh}
              onEnvWritten={() => setEnvRecreateOpen(true)}
              readOnly={!mutate}
            />
          )
        : null}

      <DashFold
        title="Metrics"
        persistKey={craneFoldKey(slug, "metrics")}
        defaultOpen
        hint="CPU, RAM, MCP, tokens"
        aside={(
          <SpendScope
            window={spendWindow}
            onWindow={setSpendWindow}
            bucket={bucket}
            onBucket={setSpendBucket}
            buckets={allowedBuckets}
          />
        )}
      >
        <CraneSpend rollup={labelRollup(rollupTurns(slug, turnsInWindow), userNames)} scope={fmtSpendWindow(spendWindow)} observe={observe} />
        <Suspense fallback={<ChartSkeleton n={6} />}>
          <MetricCharts host={host} turns={turns} mcp={mcp} uptime={uptime} bucket={bucket} since={since} now={now} timeZone={observe?.timezone} />
        </Suspense>
      </DashFold>

      <DashFold title="Logs" persistKey={craneFoldKey(slug, "logs")} defaultOpen hint="live slog">
        <LogViewer slug={slug} />
      </DashFold>

      <EventStrip slug={slug} />

      <DoctorPanel doctor={doctor} persistKey={craneFoldKey(slug, "doctor")} />

      <ToolsFold dash={dash} />
      <PersonaFold dash={dash} />
      <SecretsFold dash={dash} />
      <PinFold dash={dash} />

      {destroyOpen
        ? (
            <YardModal
              title={`Destroy ${slug}`}
              onClose={() => setDestroyOpen(false)}
              footer={(
                <>
                  <button
                    type="button"
                    onClick={() => setDestroyOpen(false)}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void destroy()}
                    className="rounded border border-red-900/70 bg-red-950/40 px-3 py-1.5 text-xs text-red-200 hover:border-red-600 disabled:opacity-50"
                  >
                    Destroy
                  </button>
                </>
              )}
            >
              <p>{HINTS.destroyCrane.hint}</p>
              <label className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={destroyFiles}
                  onChange={(e) => setDestroyFiles(e.target.checked)}
                />
                <span>
                  Also delete files
                  <span className="mt-0.5 block text-xs text-zinc-500">{HINTS.destroyFiles.hint}</span>
                </span>
              </label>
            </YardModal>
          )
        : null}
      {envRecreateOpen
        ? (
            <YardModal
              title="Recreate to apply .env"
              onClose={() => setEnvRecreateOpen(false)}
              footer={(
                <>
                  <button
                    type="button"
                    onClick={() => setEnvRecreateOpen(false)}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
                  >
                    Later
                  </button>
                  {mutate
                    ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEnvRecreateOpen(false);
                            void act("recreate");
                          }}
                          className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
                        >
                          Recreate now
                        </button>
                      )
                    : null}
                </>
              )}
            >
              <p>{HINTS.envRecreate.hint}</p>
            </YardModal>
          )
        : null}
      {injectOpen
        ? (
            <InjectUserModal
              persona={persona}
              onClose={() => setInjectOpen(false)}
              onInject={(next, label) => {
                setPersona(next);
                setInjectOpen(false);
                setNotice(`${label} injected into PERSONA.md — Save to write`);
              }}
            />
          )
        : null}
    </section>
  );
}
