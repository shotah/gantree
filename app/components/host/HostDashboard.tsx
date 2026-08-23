"use client";

import Link from "next/link";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SPEND_WINDOW, fmtBytes, fmtSpendWindow, type SpendWindow, windowStart } from "@/lib/yard/observe/spend";
import type { HostLive, HostRuntime, ObservePrefs, YardDbInspect } from "@/lib/yard/types";
import { secretBadge } from "@/lib/yard/secretLook";
import { craneFoldKey, DashFold } from "../shared/DashFold";
import { EventStrip } from "../shared/EventStrip";
import { HostAvatar, HostMeters } from "../yard/HostCard";
import { LogViewer } from "../crane/LogViewer";
import { SpendScope } from "../yard/SpendBoard";
import { ChartSkeleton } from "../shared/WhenVisible";
import { yardFetch } from "@/app/lib/yardFetch";

const HostCharts = lazy(() => import("./HostCharts").then((m) => ({ default: m.HostCharts })));

type HostMeta = {
  host?: HostLive;
  dockerError?: string | null;
  yard?: string;
  source?: string;
  canMutate?: boolean;
  runtime?: HostRuntime | null;
  error?: string;
  observe?: ObservePrefs;
};

type HostFiles = {
  toml: string | null;
  tomlPath: string;
  compose: string | null;
  composePath: string;
};

export function HostDashboard() {
  const [meta, setMeta] = useState<HostMeta | null>(null);
  const [files, setFiles] = useState<HostFiles | null>(null);
  const [db, setDb] = useState<YardDbInspect | null>(null);
  const [toml, setToml] = useState("");
  const [confirmToml, setConfirmToml] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [spendWindow, setSpendWindow] = useState<SpendWindow>(DEFAULT_SPEND_WINDOW);
  const [now, setNow] = useState(() => Date.now());
  const filesLoaded = useRef(false);

  const refresh = useCallback(() => {
    yardFetch("/api/host")
      .then((r) => r.json())
      .then((d: HostMeta) => {
        setMeta(d);
        setNow(Date.now());
        if (d.canMutate) {
          if (!filesLoaded.current) {
            filesLoaded.current = true;
            yardFetch("/api/host/files")
              .then((r) => r.json())
              .then((f: HostFiles) => {
                setFiles(f);
                if (f.toml != null) {
                  setToml(f.toml);
                }
              })
              .catch(() => undefined);
          }
          yardFetch("/api/host/db")
            .then((r) => r.json())
            .then((row: YardDbInspect) => setDb(row))
            .catch(() => undefined);
        }
      })
      .catch((err: unknown) => setMeta({ error: err instanceof Error ? err.message : String(err) }));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    setNow(Date.now());
  }, [spendWindow]);

  async function saveToml() {
    setBusy(true);
    const res = await yardFetch("/api/host/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toml, confirm: confirmToml }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setNotice(res.ok ? "gantree.toml written — board refresh picks up inventory" : data.error || "could not write gantree.toml");
    setBusy(false);
    if (res.ok) {
      filesLoaded.current = false;
      setConfirmToml(false);
    }
    refresh();
  }

  const live = meta?.host?.live ?? null;
  const spark = meta?.host?.spark ?? [];
  const since = windowStart(spendWindow, now);
  const name = live?.hostname || "Host";
  const mutate = Boolean(meta?.canMutate);
  const runtime = meta?.runtime;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="flex items-start gap-3">
          <HostAvatar size="lg" />
          <div>
            <Link href="/" className="text-xs text-zinc-500 hover:text-amber-500 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:text-sm">
              ← shipping yard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="text-sm text-zinc-500 max-sm:break-words">
              {live
                ? `${live.ncpu} cores · ${fmtBytes(live.memTotalBytes)} · ${meta?.yard ?? "yard"} · ${meta?.source ?? ""}`
                : meta?.dockerError || "loading…"}
            </p>
          </div>
        </div>
        {mutate
          ? (
              <Link
                href="/settings"
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-stone-200 hover:border-amber-700 max-sm:text-sm"
              >
                operators
              </Link>
            )
          : null}
      </div>

      {!mutate && meta
        ? (
            <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
              read only — metrics only. An admin can edit gantree.toml and inspect sqlite from here.
            </p>
          )
        : null}

      {notice ? <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{notice}</p> : null}
      {meta?.error ? <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">{meta.error}</p> : null}

      <DashFold
        title="Metrics"
        persistKey={craneFoldKey("host", "metrics")}
        defaultOpen
        hint="Mini CPU, RAM, and net vs agents and this dashboard"
        aside={<SpendScope window={spendWindow} onWindow={setSpendWindow} />}
      >
        {live ? <HostMeters live={live} spark={spark} /> : <p className="text-sm text-zinc-500">{meta?.dockerError || "Sampling Docker…"}</p>}
        <Suspense fallback={<ChartSkeleton n={4} className="mt-3 grid gap-3 md:grid-cols-2" />}>
          <HostCharts spark={spark} since={since} now={now} timeZone={meta?.observe?.timezone} />
        </Suspense>
        <p className="mt-2 text-[11px] text-zinc-600">
          Window
          {fmtSpendWindow(spendWindow)}
          . Host samples cap at
          {meta?.observe?.hostRetainDays ?? 7}
          {" "}
          days.
        </p>
      </DashFold>

      {mutate
        ? (
            <DashFold title="Logs" persistKey={craneFoldKey("host", "logs")} hint="gantree container slog — not a crane">
              <p className="mb-2 text-xs text-zinc-600">
                Tails the console container when this process is in Docker.
                {" "}
                <code className="text-zinc-500">npm start</code>
                {" "}
                on the
                Mini has no container log.
              </p>
              <LogViewer src="/api/host/logs" />
            </DashFold>
          )
        : null}

      <EventStrip fold />

      {mutate
        ? (
            <DashFold
              title="Inventory"
              persistKey={craneFoldKey("host", "inventory")}
              hint="writes the whole yard — drop a crane and it leaves the board"
              summary={files?.tomlPath ? files.tomlPath.split(/[/\\]/).slice(-1)[0] : undefined}
              warn
            >
              <p className="mb-3 rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                This file is the yard. Drop a
                {" "}
                <code className="text-amber-100">[[gantry]]</code>
                {" "}
                and that crane vanishes from the
                board (dirs on disk stay). Invalid toml and the board cannot load. Secrets still live in each crane’s
                {" "}
                <code className="text-amber-100">.env</code>
                .
                {files?.tomlPath
                  ? (
                      <>
                        {" "}
                        <code className="text-amber-100/80">{files.tomlPath}</code>
                      </>
                    )
                  : null}
              </p>
              <textarea
                className="min-h-56 w-full rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm"
                value={toml}
                onChange={(e) => setToml(e.target.value)}
                spellCheck={false}
                placeholder="# copy gantree.toml.example"
              />
              <label className="mt-3 flex items-center gap-2 text-xs text-amber-200">
                <input type="checkbox" checked={confirmToml} onChange={(e) => setConfirmToml(e.target.checked)} />
                I am rewriting gantree.toml
              </label>
              <button
                type="button"
                disabled={busy || !confirmToml}
                onClick={() => void saveToml()}
                className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
              >
                Save gantree.toml
              </button>
            </DashFold>
          )
        : null}

      {mutate
        ? (
            <DashFold
              title="Sqlite"
              persistKey={craneFoldKey("host", "sqlite")}
              hint="yard gantree.db — not a crane’s gantry.db"
              summary={db ? `${db.tables.length} tables` : undefined}
            >
              <p className="mb-2 text-xs text-zinc-600">
                Operators, sessions, samples, audit. Counts only — pass hashes never leave this box.
                {db?.path
                  ? (
                      <>
                        {" "}
                        <code className="text-zinc-500">{db.path}</code>
                        {db.sizeBytes != null ? ` · ${fmtBytes(db.sizeBytes)}` : ""}
                        {db.journal ? ` · ${db.journal}` : ""}
                      </>
                    )
                  : null}
              </p>
              {db
                ? (
                    <ul className="space-y-1 text-sm text-zinc-400">
                      {db.tables.map((t) => (
                        <li key={t.name} className="flex justify-between gap-2 font-mono text-xs">
                          <span className="text-zinc-300">{t.name}</span>
                          <span className="tabular-nums text-zinc-500">{t.rows}</span>
                        </li>
                      ))}
                    </ul>
                  )
                : (
                    <p className="text-sm text-zinc-500">loading…</p>
                  )}
            </DashFold>
          )
        : null}

      {mutate && runtime
        ? (
            <DashFold title="Runtime" persistKey={craneFoldKey("host", "runtime")} hint="how this process was started">
              <dl className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <dt>bind</dt>
                  <dd className="font-mono text-zinc-200">
                    {runtime.bind}
                    {runtime.bindOpen ? " · all interfaces" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>root</dt>
                  <dd className="truncate font-mono text-zinc-200" title={runtime.root}>
                    {runtime.root}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>toml</dt>
                  <dd className="truncate font-mono text-zinc-200" title={runtime.tomlPath}>
                    {runtime.tomlPath}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>sqlite</dt>
                  <dd className="truncate font-mono text-zinc-200" title={runtime.dbPath}>
                    {runtime.dbPath}
                  </dd>
                </div>
                {runtime.craneUser
                  ? (
                      <div className="flex justify-between gap-2">
                        <dt>crane user</dt>
                        <dd className="font-mono text-zinc-200">{runtime.craneUser}</dd>
                      </div>
                    )
                  : null}
              </dl>
              <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">process env</p>
              <ul className="mt-1 space-y-1 font-mono text-xs text-zinc-400">
                {Object.entries(runtime.env).map(([k, row]) => {
                  const badge = secretBadge(row, row.value);
                  return (
                    <li key={k} className="flex justify-between gap-2">
                      <span>{k}</span>
                      <span className={`truncate ${badge.missing ? "text-amber-200" : "text-zinc-300"}`}>{badge.text}</span>
                    </li>
                  );
                })}
              </ul>
              {files?.compose
                ? (
                    <>
                      <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">
                        compose.yml
                        {files.composePath ? <span className="ml-2 normal-case text-zinc-500">{files.composePath}</span> : null}
                      </p>
                      <pre className="mt-1 max-h-56 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                        {files.compose}
                      </pre>
                    </>
                  )
                : null}
            </DashFold>
          )
        : null}
    </section>
  );
}
