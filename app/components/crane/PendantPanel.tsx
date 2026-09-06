"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatPendantEntry,
  operatorOnPendantList,
  parsePendantAllowlist,
  parsePendantEntry,
  pendantEntryForOperator,
  type PendantSnapshot,
} from "@/lib/yard/crane/pendantShape";
import { HINTS } from "@/lib/yard/hints";
import type { StoreSubSuggestion } from "@/lib/yard/observe/spend";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import { useDoor } from "../shared/DoorShell";
import { yardFetch } from "@/app/lib/yardFetch";

type PendantOperator = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  channels?: { google?: string[] };
};

export function PendantPanel({
  slug,
  busy,
  setBusy,
  onNotice,
  onSaved,
  onEnvWritten,
  storeSub = null,
  readOnly = false,
}: {
  slug: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotice: (msg: string) => void;
  onSaved: () => void;
  onEnvWritten?: () => void;
  storeSub?: StoreSubSuggestion | null;
  readOnly?: boolean;
}) {
  const { operator } = useDoor();
  const [snap, setSnap] = useState<PendantSnapshot | null>(null);
  const [allow, setAllow] = useState<string[]>([]);
  const [addRaw, setAddRaw] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [operators, setOperators] = useState<PendantOperator[]>([]);

  const load = useCallback(() => {
    yardFetch(`/api/gantries/${slug}/pendant`)
      .then((r) => r.json())
      .then((d: PendantSnapshot & { error?: string }) => {
        if (d.error || d.enabled === false) {
          setSnap(d.error ? null : d);
          return;
        }
        setSnap(d);
        setAllow(d.allowlist);
      })
      .catch(() => undefined);
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: PendantOperator[] }) => {
        setOperators(d.operators ?? []);
      })
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!snap?.enabled) {
    return null;
  }

  const entries = parsePendantAllowlist(allow);
  const eligible = operators.filter((op) => pendantEntryForOperator(asPendantOp(op)).ok);
  const seenNew = (snap.seen ?? []).filter((s) => !entries.some((e) => e.sub === s.id));
  const suggestion = storeSub ?? snap.suggestion;
  const canStore
    = Boolean(suggestion)
      && !readOnly
      && Boolean(operator && (operator.role === "admin" || operator.id === suggestion?.operatorId));
  const locked = busy || readOnly;

  function addEntry(raw: string) {
    const t = raw.trim();
    setAddErr(null);
    if (!t) {
      return;
    }
    const parsed = parsePendantEntry(t);
    if (!parsed) {
      setAddErr("need a Google sub, email, or sub:email");
      return;
    }
    setAllow((cur) => parsePendantAllowlist([...cur, formatPendantEntry(parsed)]).map(formatPendantEntry));
    setAddRaw("");
  }

  function toggleOperator(op: PendantOperator, on: boolean) {
    const made = pendantEntryForOperator(asPendantOp(op));
    if (!made.ok) {
      return;
    }
    if (on) {
      setAllow((cur) => parsePendantAllowlist([...cur, made.entry]).map(formatPendantEntry));
      return;
    }
    const email = op.email.trim().toLowerCase();
    const google = new Set(op.channels?.google ?? []);
    setAllow((cur) =>
      parsePendantAllowlist(cur)
        .filter((e) => !((e.sub && google.has(e.sub)) || (e.email && email && e.email === email)))
        .map(formatPendantEntry),
    );
  }

  async function save() {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/pendant`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: allow }),
    });
    const data = (await res.json()) as { detail?: string; error?: string; allowlist?: string[] };
    onNotice(data.detail || data.error || res.statusText);
    if (res.ok && Array.isArray(data.allowlist)) {
      setAllow(data.allowlist);
    }
    setBusy(false);
    if (res.ok) {
      load();
      onSaved();
      onEnvWritten?.();
    }
  }

  async function storeSuggestion() {
    if (!suggestion) {
      return;
    }
    setBusy(true);
    const res = await yardFetch("/api/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "google-sub", id: suggestion.operatorId, sub: suggestion.userId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      onNotice(data.error || res.statusText);
      return;
    }
    onNotice(`stored ${suggestion.userId} on ${suggestion.operatorName}'s profile`);
    load();
    onSaved();
  }

  return (
    <DashFold
      title="Pendant"
      persistKey={craneLayoutKey("pendant")}
      shot="pendant"
      summary={
        snap.bearerSet
          ? (
              `${allow.length} on the list`
            )
          : (
              <span className="text-mark">no bearer</span>
            )
      }
      hint="allowlist, recreate to apply"
      aside={(
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className="rounded border border-edge px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
        >
          refresh
        </button>
      )}
    >
      <p className="mb-3 text-xs text-faint">
        Who may talk on the phone mouth. Writes
        {" "}
        <code className="text-dim">PENDANT_ALLOWED_USERS</code>
        {" "}
        as
        {" "}
        <code className="text-dim">sub:email</code>
        {" "}
        when the Google sub is known, otherwise the profile email. Recreate after save.
      </p>
      {!snap.bearerSet
        ? (
            <p className="mb-3 text-sm text-mark">Paste PENDANT_BEARER in Secrets, then refresh.</p>
          )
        : null}
      {snap.mailboxUrl
        ? (
            <p className="mb-3 text-xs text-dim">
              mailbox
              {" "}
              <code className="break-all">{snap.mailboxUrl}</code>
            </p>
          )
        : (
            <p className="mb-3 text-sm text-mark">Paste PENDANT_MAILBOX_URL in Secrets.</p>
          )}

      {suggestion
        ? (
            <div className="mb-4 rounded border border-accent-line bg-accent-soft px-3 py-2 text-xs text-mark">
              <p>
                store
                {" "}
                <code className="text-fg">{suggestion.userId}</code>
                {" "}
                on
                {" "}
                {suggestion.operatorName}
                's profile
              </p>
              {canStore
                ? (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => void storeSuggestion()}
                      className="mt-2 rounded border border-accent-line px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
                    >
                      store on
                      {" "}
                      {suggestion.operatorName}
                      's profile
                    </button>
                  )
                : (
                    <p className="mt-1 text-[11px] text-faint">admin or that operator can store it</p>
                  )}
            </div>
          )
        : null}

      <div className="border-t border-line pt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-dim">Allowlist</h3>
        <p className="mt-1 text-xs text-faint">
          Tick operators (email matches until the
          {" "}
          <code className="text-dim">sub</code>
          {" "}
          is learned), or paste extra
          {" "}
          <code className="text-dim">sub</code>
          {" "}
          /
          {" "}
          <code className="text-dim">sub:email</code>
          {" "}
          /
          email. Seen
          {" "}
          <code className="text-dim">user_id</code>
          {" "}
          from slog that match no entry show up below.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {allow.length === 0 ? <li className="text-xs text-faint">none yet</li> : null}
          {allow.map((id) => (
            <li key={id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => setAllow((cur) => cur.filter((x) => x !== id))}
                className="rounded border border-edge px-2 py-0.5 text-xs text-fg hover:border-danger hover:text-danger disabled:opacity-50"
                title="remove"
              >
                {id}
                {" "}
                ×
              </button>
            </li>
          ))}
        </ul>
        {eligible.length
          ? (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-wide text-faint">operators</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {eligible.map((op) => {
                    const label = op.displayName.trim() || op.name;
                    const sub = (op.channels?.google ?? [])[0];
                    const on = operatorOnPendantList(asPendantOp(op), entries);
                    return (
                      <li key={op.id}>
                        <label className="inline-flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-fg">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked}
                            onChange={(e) => toggleOperator(op, e.target.checked)}
                          />
                          {label}
                          {op.email
                            ? (
                                <span className="text-dim">{op.email}</span>
                              )
                            : null}
                          {sub
                            ? (
                                <span className="rounded border border-edge px-1 text-[10px] text-muted">
                                  sub
                                </span>
                              )
                            : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          : null}
        {seenNew.length
          ? (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-wide text-faint">seen talking</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {seenNew.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => addEntry(s.id)}
                        className="rounded border border-accent-line bg-accent-soft px-2 py-0.5 text-xs text-mark hover:border-accent disabled:opacity-50"
                      >
                        add
                        {" "}
                        {s.id}
                        <span className="ml-1 text-dim">
                          {s.turns}
                          t
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-line bg-canvas px-2 py-1 text-sm sm:min-w-40"
            placeholder="sub, email, or sub:email"
            value={addRaw}
            disabled={readOnly}
            onChange={(e) => {
              setAddRaw(e.target.value);
              setAddErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEntry(addRaw);
              }
            }}
          />
          <button
            type="button"
            disabled={locked || !addRaw.trim()}
            onClick={() => addEntry(addRaw)}
            className="rounded border border-edge px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
          >
            add
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void save()}
            className="rounded border border-edge px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
          >
            Save allowlist
          </button>
        </div>
        {addErr ? <p className="mt-2 text-xs text-mark">{addErr}</p> : null}
        <p className="mt-2 text-[11px] text-faint">{HINTS.envRecreate.hint}</p>
      </div>
    </DashFold>
  );
}

function asPendantOp(op: PendantOperator): { email: string; channels: { google: string[] } } {
  return { email: op.email ?? "", channels: { google: op.channels?.google ?? [] } };
}
