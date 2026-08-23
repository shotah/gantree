"use client";

import Link from "next/link";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { secretKeysForGrant } from "@/lib/yard/tools/packages";
import {
  bucketsForWindow,
  filterSamples,
  fmtSpendWindow,
  labelRollup,
  rollupTurns,
  windowStart,
  DEFAULT_SPEND_WINDOW,
  type SpendBucket,
  type SpendWindow,
} from "@/lib/yard/observe/spend";
import { shouldPushTelegram } from "@/lib/yard/host/telegram";
import { DEFAULT_IMAGE, type CatalogEntry, type DoctorReport, type GantryCard, type McpSample, type McpServer, type ObservePrefs, type StatSample, type TurnSample, type UptimeSample } from "@/lib/yard/types";
import { CraneAvatar } from "./CraneAvatar";
import { craneFoldKey, DashFold } from "./DashFold";
import { DoctorPanel } from "./DoctorPanel";
import { EventStrip } from "./EventStrip";
import { LogViewer } from "./LogViewer";
import { CraneSpend, SpendScope } from "./SpendBoard";
import { TelegramBot } from "./TelegramBot";
import { ChartSkeleton } from "./WhenVisible";
import { jpegFromFile } from "../lib/jpegFromFile";
import { yardFetch } from "../lib/yardFetch";

const MetricCharts = lazy(() => import("./MetricCharts").then((m) => ({ default: m.MetricCharts })));

type EnvRow = { set: boolean; secret: boolean; value: string };
type Files = {
  persona: string | null;
  self: string | null;
  mcp: string | null;
  servers: McpServer[];
  env?: Record<string, EnvRow>;
  writable: boolean;
};

export function AgentDashboard({ slug }: { slug: string }) {
  const [gantry, setGantry] = useState<GantryCard | null>(null);
  const [denied, setDenied] = useState(false);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [host, setHost] = useState<StatSample[]>([]);
  const [turns, setTurns] = useState<TurnSample[]>([]);
  const [mcp, setMcp] = useState<McpSample[]>([]);
  const [uptime, setUptime] = useState<UptimeSample[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [observe, setObserve] = useState<ObservePrefs | null>(null);
  const [files, setFiles] = useState<Files | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [persona, setPersona] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState(DEFAULT_IMAGE);
  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({});
  const [confirmToken, setConfirmToken] = useState(false);
  const [authFor, setAuthFor] = useState<string | null>(null);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [spendWindow, setSpendWindow] = useState<SpendWindow>(DEFAULT_SPEND_WINDOW);
  const [spendBucket, setSpendBucket] = useState<SpendBucket>("cumulative");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    yardFetch(`/api/gantries/${slug}`)
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) {
          setDenied(true);
          return;
        }
        const g = (await r.json()) as GantryCard & { error?: string };
        if (!g.error) {
          setDenied(false);
          setGantry(g);
          if (g.image) {
            setPin(g.image);
          }
        }
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/doctor`)
      .then((r) => r.json())
      .then((d: DoctorReport) => setDoctor(d))
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/stats`)
      .then((r) => r.json())
      .then((s: { host: StatSample[]; turns: TurnSample[]; mcp: McpSample[]; uptime: UptimeSample[]; userNames?: Record<string, string>; observe?: ObservePrefs }) => {
        setHost(s.host ?? []);
        setTurns(s.turns ?? []);
        setMcp(s.mcp ?? []);
        setUptime(s.uptime ?? []);
        setUserNames(s.userNames ?? {});
        setObserve(s.observe ?? null);
        setNow(Date.now());
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/files`)
      .then((r) => r.json())
      .then((f: Files) => {
        setFiles(f);
        if (f.persona != null) {
          setPersona(f.persona);
        }
      })
      .catch(() => undefined);
    yardFetch(`/api/gantries/${slug}/grant`)
      .then((r) => r.json())
      .then((c: { catalog: CatalogEntry[] }) => setCatalog(c.catalog ?? []))
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    setNow(Date.now());
  }, [spendWindow]);

  async function act(action: string) {
    setBusy(true);
    setNotice(action === "recreate" || action === "pin" ? "recreating — waiting for doctor…" : null);
    const res = await yardFetch(`/api/gantries/${slug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, image: action === "pin" ? pin : undefined }),
    });
    const data = (await res.json()) as { detail?: string; error?: string };
    setNotice(data.detail || data.error || res.statusText);
    setBusy(false);
    refresh();
  }

  async function authOp(server: string, op: "start" | "exchange" | "wait") {
    setBusy(true);
    setAuthFor(server);
    const res = await yardFetch(`/api/gantries/${slug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server, op, code: op === "exchange" ? authCode : undefined }),
    });
    const data = (await res.json()) as { detail?: string; url?: string | null; error?: string };
    setAuthDetail(data.detail || data.error || res.statusText);
    setAuthUrl(data.url ?? null);
    setNotice(data.detail || data.error || "auth");
    if (op === "exchange" && res.ok) {
      setAuthCode("");
    }
    setBusy(false);
    refresh();
  }

  async function toggleGrant(name: string, on: boolean) {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, op: on ? "grant" : "revoke" }),
    });
    const data = (await res.json()) as { detail?: string; error?: string };
    setNotice(data.detail || data.error || res.statusText);
    setBusy(false);
    refresh();
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    setNotice(null);
    try {
      const jpeg = await jpegFromFile(file);
      const body = new FormData();
      body.append("file", jpeg, "avatar.jpg");
      const res = await yardFetch(`/api/gantries/${slug}/avatar`, { method: "POST", body });
      const data = (await res.json()) as { detail?: string; error?: string };
      setNotice(data.detail || data.error || res.statusText);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
    refresh();
  }

  async function savePersona() {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    });
    setNotice(res.ok ? "PERSONA.md written — recreate to reload" : "could not write PERSONA.md");
    setBusy(false);
    refresh();
  }

  const granted = new Set((files?.servers ?? []).map((s) => s.name));
  const mutate = Boolean(gantry?.canMutate || files?.writable);
  const telegramOn =
    shouldPushTelegram(gantry?.channel ?? null) ||
    shouldPushTelegram(files?.env?.CHANNEL?.value ?? null) ||
    Boolean(files?.env?.TELEGRAM_BOT_TOKEN?.set);
  const since = windowStart(spendWindow, now);
  const allowedBuckets = bucketsForWindow(spendWindow);
  const bucket = allowedBuckets.includes(spendBucket) ? spendBucket : "cumulative";
  const turnsInWindow = filterSamples(turns, since, now);

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
        {mutate ? (
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
          </div>
        ) : null}
      </div>

      {!mutate ? (
        <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
          read only — you can look, not grant or recreate.
        </p>
      ) : null}

      {notice ? <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{notice}</p> : null}

      <DashFold
        title="Photo"
        persistKey={craneFoldKey(slug, "photo")}
        shot="photo"
        hint="persona/avatar.jpg — Telegram uses the same picture"
      >
        <p className="mb-3 text-xs text-zinc-600">
          Saved as <code className="text-zinc-500">persona/avatar.jpg</code>. Telegram bots get the same picture.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <CraneAvatar slug={slug} rev={gantry?.avatarRev ?? null} size="xl" />
          {mutate ? (
            <div className="flex flex-col gap-2">
              <label
                className={`inline-flex w-fit rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 ${
                  busy || !gantry?.personaDir ? "opacity-50" : "cursor-pointer"
                }`}
              >
                Choose photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={busy || !gantry?.personaDir}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) {
                      void uploadPhoto(f);
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-zinc-600">JPEG, PNG, WebP, or GIF. PNG/WebP are converted on upload.</p>
            </div>
          ) : null}
        </div>
      </DashFold>

      {telegramOn ? (
        <TelegramBot slug={slug} busy={busy} setBusy={setBusy} onNotice={setNotice} onSaved={refresh} readOnly={!mutate} />
      ) : null}

      <DashFold
        title="Metrics"
        persistKey={craneFoldKey(slug, "metrics")}
        defaultOpen
        hint="CPU, RAM, MCP, tokens"
        aside={
          <SpendScope
            window={spendWindow}
            onWindow={setSpendWindow}
            bucket={bucket}
            onBucket={setSpendBucket}
            buckets={allowedBuckets}
          />
        }
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

      <DashFold
        title="Tools"
        persistKey={craneFoldKey(slug, "tools")}
        summary={`${granted.size} granted`}
        hint="mcp.toml — recreate fetches bins"
      >
        <p className="mb-3 text-xs text-zinc-600">
          Toggle writes mcp.toml. Recreate fetches bins into /data/bin and reloads MCP.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !mutate}
            onClick={async () => {
              setBusy(true);
              const res = await yardFetch(`/api/gantries/${slug}/grant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ op: "fetch" }),
              });
              const data = (await res.json()) as { detail?: string };
              setNotice(data.detail || res.statusText);
              setBusy(false);
              refresh();
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            tools-fetch
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((c) => {
            const on = granted.has(c.name);
            const needsAuth = Boolean(c.auth_args?.length) && on;
            const open = authFor === c.name;
            return (
              <div key={c.name} className="flex flex-col gap-2 rounded border border-zinc-800 px-3 py-2 text-sm">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={on} disabled={busy || !mutate || !files?.writable} onChange={() => toggleGrant(c.name, !on)} />
                  <span className="flex-1">
                    <span className="font-medium text-stone-100">{c.name}</span>
                    <span className="block text-xs text-zinc-500">{c.blurb}</span>
                  </span>
                  {needsAuth && mutate ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAuthFor(open ? null : c.name);
                        setAuthDetail(null);
                        setAuthUrl(null);
                      }}
                      className="rounded border border-amber-800 px-2 py-1 text-xs text-amber-200"
                    >
                      needs auth
                    </button>
                  ) : null}
                </div>
                {needsAuth && open ? (
                  <div className="ml-7 space-y-2 rounded border border-zinc-800 bg-zinc-950/80 p-2 text-xs">
                    <p className="text-zinc-400">
                      After <code className="text-amber-200">/auth {c.name}</code> in Telegram, paste the code here. Or start a hop
                      from this console (catch page:{" "}
                      <a className="text-amber-200 underline" href="https://shotah.github.io/ai-gantry/oauth-catch/" target="_blank" rel="noreferrer">
                        oauth-catch
                      </a>
                      ).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => authOp(c.name, "start")}
                        className="rounded border border-zinc-700 px-2 py-1 hover:border-amber-700 disabled:opacity-50"
                      >
                        start hop
                      </button>
                      {c.authFlow === "device" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => authOp(c.name, "wait")}
                          className="rounded border border-zinc-700 px-2 py-1 hover:border-amber-700 disabled:opacity-50"
                        >
                          wait (device poll)
                        </button>
                      ) : null}
                    </div>
                    {authUrl ? (
                      <p>
                        <a className="break-all text-amber-200 underline" href={authUrl} target="_blank" rel="noreferrer">
                          {authUrl}
                        </a>
                      </p>
                    ) : null}
                    {authDetail ? <p className="whitespace-pre-wrap text-zinc-500">{authDetail}</p> : null}
                    {c.authFlow === "device" ? null : (
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="min-w-40 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1"
                          placeholder={c.authFlow === "mfa" ? "MFA code from email" : "paste code"}
                          value={authCode}
                          onChange={(e) => setAuthCode(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy || !authCode.trim()}
                          onClick={() => authOp(c.name, "exchange")}
                          className="rounded border border-amber-800 px-2 py-1 text-amber-200 disabled:opacity-50"
                        >
                          submit code
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </DashFold>

      <DashFold title="Persona" persistKey={craneFoldKey(slug, "persona")} hint="PERSONA.md — SELF.md is harness-written">
        <p className="mb-2 text-xs text-zinc-600">
          SELF.md is harness-written — prune, don’t treat it as config.
        </p>
        {files?.self ? <pre className="mb-3 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">{files.self}</pre> : null}
        <textarea
          className="min-h-40 w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-sm"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          disabled={!files?.writable}
          placeholder="PERSONA.md — set persona_dir in gantree.toml to edit"
        />
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={savePersona}
          className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Save PERSONA.md
        </button>
      </DashFold>

      <DashFold title="Secrets" persistKey={craneFoldKey(slug, "secrets")} hint="crane mouth plus keys for granted tools">
        <p className="mb-2 text-xs text-zinc-600">
          Only the crane mouth plus keys for <em>granted</em> tools. Toggle a server
          first. Never paste a whole fleet .env. Values are never shown after save.
          Recreate after env change.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {secretKeysForGrant([...granted], catalog).map((k) => {
            const row = files?.env?.[k] ?? { set: false, secret: /TOKEN|KEY|SECRET|PASSWORD/i.test(k), value: "" };
            return (
            <label key={k} className="flex flex-col gap-1 text-xs">
              <span className="text-zinc-500">
                {k}
                {row.set ? " · set" : " · empty"}
              </span>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1"
                type={row.secret ? "password" : "text"}
                placeholder={row.secret ? "unchanged if blank" : row.value}
                value={secretDraft[k] ?? ""}
                disabled={!files?.writable}
                onChange={(e) => setSecretDraft((s) => ({ ...s, [k]: e.target.value }))}
              />
            </label>
          );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-amber-200">
          <input type="checkbox" checked={confirmToken} onChange={(e) => setConfirmToken(e.target.checked)} disabled={!files?.writable} />
          I am overwriting secrets / bot tokens
        </label>
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={async () => {
            setBusy(true);
            const res = await yardFetch(`/api/gantries/${slug}/files`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ env: secretDraft, confirmToken }),
            });
            setNotice(res.ok ? "env written — recreate (do not just restart)" : "env write refused (confirm token?)");
            setBusy(false);
            setSecretDraft({});
            setConfirmToken(false);
            refresh();
          }}
          className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Save .env
        </button>
      </DashFold>

      <DashFold title="Image pin" persistKey={craneFoldKey(slug, "pin")} hint="pull + recreate tag">
        <p className="mb-2 text-xs text-zinc-600">
          pull + recreate uses this tag, keeps the host uid that owns <code className="text-zinc-500">data/</code>, and
          waits for doctor. Recreate without pull does the same uid keep — it does not docker pull.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className="min-w-64 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs max-sm:min-w-0 max-sm:w-full max-sm:text-sm" value={pin} onChange={(e) => setPin(e.target.value)} disabled={!mutate} />
          <button
            type="button"
            disabled={busy || !mutate}
            onClick={() => act("pin")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            pull + recreate
          </button>
        </div>
      </DashFold>
    </section>
  );
}
