"use client";

import { useEffect, useState } from "react";
import { yardFetch } from "@/app/lib/yardFetch";
import { HINTS } from "@/lib/yard/hints";
import type { PendantSettingsView } from "@/lib/yard/pendant/shape";
import { secretLook } from "@/lib/yard/secretLook";
import { HintField } from "../shared/HintField";

export function PendantPane() {
  const [view, setView] = useState<PendantSettingsView | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [workerName, setWorkerName] = useState("gantry-pendant");
  const [origin, setOrigin] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [allowedSubs, setAllowedSubs] = useState("");
  const [rotateSession, setRotateSession] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    yardFetch("/api/pendant")
      .then((r) => r.json())
      .then((d: { pendant?: PendantSettingsView; error?: string }) => {
        if (d.error || !d.pendant) {
          setErr(d.error || "could not load pendant settings");
          return;
        }
        setView(d.pendant);
        setAccountId(d.pendant.accountId);
        setWorkerName(d.pendant.workerName || "gantry-pendant");
        setOrigin(d.pendant.origin);
        setGoogleClientId(d.pendant.googleClientId);
        setAllowedSubs(d.pendant.allowedSubs);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await yardFetch("/api/pendant", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        apiToken,
        accountId,
        workerName,
        origin,
        googleClientId,
        googleClientSecret,
        allowedSubs,
        rotateSession,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      pendant?: PendantSettingsView;
    };
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || data.detail || res.statusText);
      return;
    }
    if (data.pendant) {
      setView(data.pendant);
    }
    setApiToken("");
    setGoogleClientSecret("");
    setRotateSession(false);
    setConfirm(false);
    setNotice(data.detail || "pushed to Cloudflare");
  }

  if (!view) {
    return <p className="text-sm text-dim">{err || "loading pendant settings…"}</p>;
  }

  const tokenLook = secretLook({ set: view.apiTokenSet, secret: true }, apiToken, "token");
  const secretLookGoogle = secretLook(
    { set: view.googleClientSecretSet, secret: true },
    googleClientSecret,
    "key",
  );

  return (
    <form className="flex max-w-lg flex-col gap-3 rounded-lg border border-line bg-panel/60 p-4" onSubmit={save}>
      {err ? <p className="text-sm text-mark">{err}</p> : null}
      {notice ? <p className="text-sm text-body">{notice}</p> : null}
      <p className="text-xs text-dim">
        Worker <em>code</em> stays gantry-pendant CI. This fold holds the Cloudflare token and pushes Google, session, and per-crane bearers. Cranes never see this token.
      </p>
      <HintField label="Cloudflare API token" {...HINTS.cfApiToken}>
        <input
          className={`rounded border bg-canvas px-3 py-2 text-sm text-fg ${
            tokenLook.missing ? "border-accent-line placeholder:text-mark/90" : "border-line"
          }`}
          type={tokenLook.type}
          autoComplete="off"
          spellCheck={false}
          placeholder={tokenLook.placeholder}
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
        />
      </HintField>
      <HintField label="account id" {...HINTS.cfAccountId}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 font-mono text-sm text-fg"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </HintField>
      <HintField label="Worker name" {...HINTS.cfWorkerName}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={workerName}
          onChange={(e) => setWorkerName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </HintField>
      <HintField label="pendant origin" {...HINTS.pendantOrigin}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="https://gantry-pendant.example.workers.dev"
          autoComplete="off"
          spellCheck={false}
        />
      </HintField>
      {view.googleRedirect
        ? (
            <p className="break-all font-mono text-[11px] text-dim">
              GCP redirect:
              {" "}
              {view.googleRedirect}
            </p>
          )
        : null}
      <HintField label="Google client id" {...HINTS.pendantGoogleClientId}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </HintField>
      <HintField label="Google client secret" {...HINTS.pendantGoogleClientSecret}>
        <input
          className={`rounded border bg-canvas px-3 py-2 text-sm text-fg ${
            secretLookGoogle.missing ? "border-accent-line placeholder:text-mark/90" : "border-line"
          }`}
          type={secretLookGoogle.type}
          autoComplete="off"
          spellCheck={false}
          placeholder={secretLookGoogle.placeholder}
          value={googleClientSecret}
          onChange={(e) => setGoogleClientSecret(e.target.value)}
        />
      </HintField>
      <HintField label="session secret" {...HINTS.pendantSessionSecret}>
        <p className="text-sm text-body">{view.sessionSecretSet ? "set — minted on the yard, pushed with Save" : "empty — Save mints one"}</p>
      </HintField>
      <label className="flex items-center gap-2 text-xs text-mark">
        <input type="checkbox" checked={rotateSession} onChange={(e) => setRotateSession(e.target.checked)} />
        rotate SESSION_SECRET (phones must sign in again)
      </label>
      <HintField label="ALLOWED_SUBS (optional)" {...HINTS.pendantAllowedSubs}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={allowedSubs}
          onChange={(e) => setAllowedSubs(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </HintField>
      {view.craneCount > 0
        ? (
            <p className="text-xs text-dim">
              {view.craneCount}
              {" "}
              crane
              {view.craneCount === 1 ? "" : "s"}
              {" "}
              on CRANE_BEARERS (values stay in sqlite, never shown)
            </p>
          )
        : null}
      <label className="flex items-center gap-2 text-xs text-mark">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        I am pushing Worker secrets to Cloudflare
      </label>
      <button
        type="submit"
        disabled={busy || !confirm}
        className="rounded border border-accent-line bg-accent-soft px-3 py-2 text-sm text-mark hover:border-accent disabled:opacity-50"
      >
        {busy ? "pushing…" : "Save and push"}
      </button>
    </form>
  );
}
