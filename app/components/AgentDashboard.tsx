"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { secretKeysForGrant } from "@/lib/yard/packages";
import { DEFAULT_IMAGE, type CatalogEntry, type DoctorReport, type GantryCard, type McpSample, type McpServer, type StatSample, type TurnSample, type UptimeSample } from "@/lib/yard/types";
import { LogViewer } from "./LogViewer";
import { MetricCharts } from "./MetricCharts";

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
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [host, setHost] = useState<StatSample[]>([]);
  const [turns, setTurns] = useState<TurnSample[]>([]);
  const [mcp, setMcp] = useState<McpSample[]>([]);
  const [uptime, setUptime] = useState<UptimeSample[]>([]);
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

  const refresh = useCallback(() => {
    fetch(`/api/gantries/${slug}`)
      .then((r) => r.json())
      .then((g: GantryCard & { error?: string }) => {
        if (!g.error) {
          setGantry(g);
          if (g.image) {
            setPin(g.image);
          }
        }
      })
      .catch(() => undefined);
    fetch(`/api/gantries/${slug}/doctor`)
      .then((r) => r.json())
      .then((d: DoctorReport) => setDoctor(d))
      .catch(() => undefined);
    fetch(`/api/gantries/${slug}/stats`)
      .then((r) => r.json())
      .then((s: { host: StatSample[]; turns: TurnSample[]; mcp: McpSample[]; uptime: UptimeSample[] }) => {
        setHost(s.host ?? []);
        setTurns(s.turns ?? []);
        setMcp(s.mcp ?? []);
        setUptime(s.uptime ?? []);
      })
      .catch(() => undefined);
    fetch(`/api/gantries/${slug}/files`)
      .then((r) => r.json())
      .then((f: Files) => {
        setFiles(f);
        if (f.persona != null) {
          setPersona(f.persona);
        }
      })
      .catch(() => undefined);
    fetch(`/api/gantries/${slug}/grant`)
      .then((r) => r.json())
      .then((c: { catalog: CatalogEntry[] }) => setCatalog(c.catalog ?? []))
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function act(action: string) {
    setBusy(true);
    setNotice(action === "recreate" || action === "pin" ? "recreating — waiting for doctor…" : null);
    const res = await fetch(`/api/gantries/${slug}/run`, {
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
    const res = await fetch(`/api/gantries/${slug}/auth`, {
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
    const res = await fetch(`/api/gantries/${slug}/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, op: on ? "grant" : "revoke" }),
    });
    const data = (await res.json()) as { detail?: string; error?: string };
    setNotice(data.detail || data.error || res.statusText);
    setBusy(false);
    refresh();
  }

  async function savePersona() {
    setBusy(true);
    const res = await fetch(`/api/gantries/${slug}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    });
    setNotice(res.ok ? "PERSONA.md written — recreate to reload" : "could not write PERSONA.md");
    setBusy(false);
    refresh();
  }

  const granted = new Set((files?.servers ?? []).map((s) => s.name));

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-amber-500">
            ← shipping yard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{slug}</h1>
          <p className="text-sm text-zinc-500">
            {gantry ? `${gantry.state} · ${gantry.model ?? "no model"} · ${gantry.channel ?? "no channel"}` : "loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["start", "stop", "recreate", "backup"] as const).map((a) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              onClick={() => act(a)}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs capitalize text-stone-200 hover:border-amber-700 disabled:opacity-50"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {notice ? <p className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{notice}</p> : null}

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Metrics</h2>
        <MetricCharts host={host} turns={turns} mcp={mcp} uptime={uptime} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Logs</h2>
        <LogViewer slug={slug} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Doctor</h2>
        <ul className="space-y-2">
          {doctor?.checks.map((c) => (
            <li key={c.id} className="flex gap-3 rounded border border-zinc-800 px-3 py-2 text-sm">
              <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "ok" : "fail"}</span>
              <span className="text-zinc-300">{c.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Tools</h2>
        <p className="mb-3 text-xs text-zinc-600">
          Toggle writes mcp.toml. Fetch bins (output in the notice, not container logs), then recreate.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch(`/api/gantries/${slug}/grant`, {
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
                  <input type="checkbox" checked={on} disabled={busy || !files?.writable} onChange={() => toggleGrant(c.name, !on)} />
                  <span className="flex-1">
                    <span className="font-medium text-stone-100">{c.name}</span>
                    <span className="block text-xs text-zinc-500">{c.blurb}</span>
                  </span>
                  {needsAuth ? (
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
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Persona</h2>
        <p className="mb-2 text-xs text-zinc-600">SELF.md is harness-written — prune, don’t treat it as config.</p>
        {files?.self ? <pre className="mb-3 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">{files.self}</pre> : null}
        <textarea
          className="min-h-40 w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-sm"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="PERSONA.md — set persona_dir in gantree.toml to edit"
          disabled={!files?.writable}
        />
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={savePersona}
          className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Save PERSONA.md
        </button>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Secrets</h2>
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
                onChange={(e) => setSecretDraft((s) => ({ ...s, [k]: e.target.value }))}
              />
            </label>
          );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-amber-200">
          <input type="checkbox" checked={confirmToken} onChange={(e) => setConfirmToken(e.target.checked)} />
          I am overwriting secrets / bot tokens
        </label>
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={async () => {
            setBusy(true);
            const res = await fetch(`/api/gantries/${slug}/files`, {
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
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Image pin</h2>
        <div className="flex flex-wrap gap-2">
          <input className="min-w-64 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button
            type="button"
            disabled={busy}
            onClick={() => act("pin")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            pull + recreate
          </button>
        </div>
      </section>
    </section>
  );
}
