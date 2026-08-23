"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  MAX_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  OPERATOR_CHANNEL_KINDS,
  emptyChannels,
  parseChannelIds,
  type OperatorChannelKind,
  type OperatorChannels,
  type OperatorRole,
} from "@/lib/yard/door/channels";
import { HINTS } from "@/lib/yard/hints";
import { jpegFromFile } from "@/app/lib/jpegFromFile";
import { yardFetch } from "@/app/lib/yardFetch";
import { HintField, HintLegend } from "../shared/HintField";
import { OperatorAvatar } from "../shared/OperatorAvatar";

type OperatorRow = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  description: string;
  role: OperatorRole;
  cranes: string[];
  channels: OperatorChannels;
  avatarRev: number | null;
  createdAt: string;
};

const CHANNEL_HINT: Record<OperatorChannelKind, { label: string; placeholder: string; hint: string; example?: string }> = {
  telegram: { label: "Telegram", placeholder: "numeric id", hint: HINTS.chatTelegram.hint, example: HINTS.chatTelegram.example },
  slack: { label: "Slack", placeholder: "U012ABCDEF", hint: HINTS.chatSlack.hint, example: HINTS.chatSlack.example },
  discord: { label: "Discord", placeholder: "snowflake id", hint: HINTS.chatDiscord.hint, example: HINTS.chatDiscord.example },
};

function pingDoor() {
  window.dispatchEvent(new Event("gantree-door"));
}

function fillRow(row: OperatorRow): Pick<OperatorRow, "displayName" | "name" | "email" | "description" | "channels"> {
  return {
    displayName: row.displayName,
    name: row.name,
    email: row.email ?? "",
    description: row.description ?? "",
    channels: { ...emptyChannels(), ...row.channels },
  };
}

export function OperatorProfile({ operatorId }: { operatorId?: string } = {}) {
  const [you, setYou] = useState<OperatorRow | null>(null);
  const [subject, setSubject] = useState<OperatorRow | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [nextConfirm, setNextConfirm] = useState("");
  const [passConfirm, setPassConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [channels, setChannels] = useState<OperatorChannels>(emptyChannels());

  const mine = Boolean(you && subject && you.id === subject.id);

  const load = useCallback(() => {
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: OperatorRow[]; you?: OperatorRow; error?: string }) => {
        if (d.error) {
          setErr(d.error);
          return;
        }
        const me = d.you ?? null;
        setYou(me);
        const rows = d.operators ?? [];
        const target = operatorId
          ? (rows.find((o) => o.id === operatorId) ?? (me?.id === operatorId ? me : null))
          : me;
        if (!target) {
          setSubject(null);
          if (operatorId) {
            setErr("operator not found");
          }
          return;
        }
        setSubject(target);
        const filled = fillRow(target);
        setDisplayName(filled.displayName);
        setLoginName(filled.name);
        setEmail(filled.email);
        setDescription(filled.description);
        setChannels(filled.channels);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [operatorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await yardFetch("/api/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || res.statusText);
      return false;
    }
    return true;
  }

  async function uploadPhoto(file: File) {
    if (!subject) {
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const jpeg = await jpegFromFile(file);
      const body = new FormData();
      body.append("file", jpeg, "avatar.jpg");
      const res = await yardFetch(`/api/operators/${subject.id}/avatar`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error || res.statusText);
      } else {
        setNotice("photo updated");
        if (mine) {
          pingDoor();
        }
        load();
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const who = subject ? subject.displayName || subject.name : "";

  return (
    <section className="flex flex-col gap-8" data-shot="profile">
      <div>
        {operatorId
          ? (
              <Link href="/settings" className="text-xs text-zinc-500 hover:text-amber-500">
                ← settings
              </Link>
            )
          : null}
        <h1 className={`text-2xl font-semibold tracking-tight text-stone-100 ${operatorId ? "mt-1" : ""}`}>Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mine || !operatorId
            ? "Your face, login name, and passphrase. Roles live under settings"
            : `${who}'s face, login name, email, chat ids, and passphrase. Roles live under settings`}
          {subject
            ? (
                <>
                  {" "}
                  —
                  {" "}
                  {mine ? "you are" : `${who} is`}
                  {" "}
                  <span className="text-zinc-300">{subject.role}</span>
                  {subject.cranes?.length ? ` on ${subject.cranes.join(", ")}` : ""}
                  .
                </>
              )
            : null}
        </p>
      </div>

      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      {notice ? <p className="text-sm text-zinc-300">{notice}</p> : null}

      <div className="flex flex-wrap items-start gap-8">
        {subject
          ? (
              <form
                className="flex max-w-full min-w-[min(100%,28rem)] grow basis-[28rem] flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await post({
                      op: "profile",
                      id: subject.id,
                      name: loginName,
                      displayName,
                      email,
                      description,
                      channels,
                    })
                  ) {
                    setNotice("profile updated");
                    if (mine) {
                      pingDoor();
                    }
                    load();
                  }
                }}
              >
                <h2 className="text-sm font-medium text-zinc-400">{mine ? "You" : who}</h2>
                <p className="text-[11px] text-zinc-600">
                  UUID
                  {" "}
                  <code className="text-zinc-500">{subject.id}</code>
                  {" "}
                  — stable. Display name and photo can change. Chat ids on this operator are how spend reporting labels telegram. Email is a label, not a reset path.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <OperatorAvatar id={subject.id} rev={subject.avatarRev} name={displayName || subject.displayName} size="xl" />
                  <label
                    className={`inline-flex w-fit rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 ${
                      busy ? "opacity-50" : "cursor-pointer"
                    }`}
                  >
                    Choose photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) {
                          void uploadPhoto(f);
                        }
                      }}
                    />
                  </label>
                </div>
                <HintField label="display name" {...HINTS.displayName}>
                  <input
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={MAX_DISPLAY_NAME}
                  />
                </HintField>
                <HintField label="login name" {...HINTS.loginName}>
                  <input
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={32}
                    pattern="[a-zA-Z0-9._-]{2,32}"
                    autoComplete="username"
                  />
                </HintField>
                <HintField label="email" {...HINTS.email}>
                  <input
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={MAX_EMAIL}
                    autoComplete="email"
                  />
                </HintField>
                <HintField label="description" {...HINTS.profileBlurb}>
                  <textarea
                    className="min-h-16 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={MAX_DESCRIPTION}
                  />
                </HintField>
                <div className="flex flex-col gap-4 border-t border-zinc-800 pt-3">
                  <p className="text-xs font-medium text-zinc-500">Chat ids</p>
                  {OPERATOR_CHANNEL_KINDS.map((kind) => (
                    <IdList
                      key={kind}
                      kind={kind}
                      ids={channels[kind]}
                      setIds={(ids) => setChannels((cur) => ({ ...cur, [kind]: ids }))}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50"
                >
                  Save profile
                </button>
              </form>
            )
          : null}

        {subject
          ? (
              <form
                className="flex max-w-full min-w-[min(100%,28rem)] grow basis-[28rem] flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (next !== nextConfirm) {
                    setErr("new passphrases do not match");
                    return;
                  }
                  if (
                    await post(
                      mine
                        ? { op: "passphrase", current, next, confirm: passConfirm }
                        : { op: "passphrase", id: subject.id, next, confirm: passConfirm },
                    )
                  ) {
                    setNotice("passphrase updated");
                    setCurrent("");
                    setNext("");
                    setNextConfirm("");
                    setPassConfirm(false);
                  }
                }}
              >
                <h2 className="text-sm font-medium text-zinc-400">
                  {mine ? "Change your passphrase" : `Set ${who}'s passphrase`}
                </h2>
                {mine
                  ? (
                      <HintField label="current" {...HINTS.currentPass}>
                        <input
                          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                          type="password"
                          value={current}
                          onChange={(e) => setCurrent(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                      </HintField>
                    )
                  : (
                      <p className="text-[11px] text-zinc-600">
                        You do not need their current passphrase. Their other sessions die.
                      </p>
                    )}
                <HintField label="new" {...(mine ? HINTS.newPass : HINTS.adminPass)}>
                  <input
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </HintField>
                <HintField label="confirm new" {...HINTS.operatorConfirm}>
                  <input
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                    type="password"
                    value={nextConfirm}
                    onChange={(e) => setNextConfirm(e.target.value)}
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </HintField>
                <label className="flex items-center gap-2 text-xs text-amber-200">
                  <input type="checkbox" checked={passConfirm} onChange={(e) => setPassConfirm(e.target.checked)} />
                  {mine ? "I am changing my passphrase" : "I am setting this operator's passphrase. Their sessions dies."}
                </label>
                <button
                  type="submit"
                  disabled={busy || !passConfirm}
                  className="rounded border border-zinc-700 px-3 py-2 text-sm hover:border-amber-700 disabled:opacity-50"
                >
                  Update passphrase
                </button>
              </form>
            )
          : null}
      </div>
    </section>
  );
}

function IdList({
  kind,
  ids,
  setIds,
}: {
  kind: OperatorChannelKind;
  ids: string[];
  setIds: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const meta = CHANNEL_HINT[kind];

  function add(raw: string) {
    setAddErr(null);
    const parsed = parseChannelIds(kind, [...ids, raw]);
    if (!parsed.ok) {
      setAddErr(parsed.error);
      return;
    }
    setIds(parsed.ids);
    setDraft("");
  }

  return (
    <HintLegend label={meta.label} hint={meta.hint} example={meta.example}>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {ids.length === 0 ? <li className="text-xs text-zinc-600">none yet</li> : null}
        {ids.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setIds(ids.filter((x) => x !== id))}
              className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-stone-100 hover:border-red-800 hover:text-red-200"
              title="remove"
            >
              {id}
              {" "}
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          className="min-w-40 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
          placeholder={meta.placeholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setAddErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => add(draft)}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          add
        </button>
      </div>
      {addErr ? <p className="mt-1 text-xs text-amber-200">{addErr}</p> : null}
    </HintLegend>
  );
}
