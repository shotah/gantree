"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ensureTelegramNew,
  formatCommandLines,
  parseAllowlist,
  parseCommandLines,
  type TelegramSnapshot,
} from "@/lib/yard/host/telegram";
import { HINTS } from "@/lib/yard/hints";
import { BotFatherHint } from "./BotFatherHint";
import { craneFoldKey, DashFold } from "./DashFold";
import { HintField } from "./HintField";
import { yardFetch } from "../lib/yardFetch";

export function TelegramBot({
  slug,
  busy,
  setBusy,
  onNotice,
  onSaved,
  onEnvWritten,
  readOnly = false,
}: {
  slug: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotice: (msg: string) => void;
  onSaved: () => void;
  onEnvWritten?: () => void;
  readOnly?: boolean;
}) {
  const [snap, setSnap] = useState<TelegramSnapshot | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [about, setAbout] = useState("");
  const [commands, setCommands] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [addId, setAddId] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [operators, setOperators] = useState<{ name: string; displayName: string; telegram: string[] }[]>([]);

  const load = useCallback(() => {
    yardFetch(`/api/gantries/${slug}/telegram`)
      .then((r) => r.json())
      .then((d: TelegramSnapshot & { error?: string }) => {
        if (d.error || d.enabled === false) {
          setSnap(d.error ? null : d);
          return;
        }
        setSnap(d);
        setName(d.name);
        setDescription(d.description);
        setAbout(d.shortDescription);
        setCommands(formatCommandLines(d.commands));
        setAllow(d.allowlist);
      })
      .catch(() => undefined);
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: { name: string; displayName: string; channels?: { telegram?: string[] } }[] }) => {
        setOperators(
          (d.operators ?? []).map((o) => ({
            name: o.name,
            displayName: o.displayName,
            telegram: o.channels?.telegram ?? [],
          })),
        );
      })
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!snap?.enabled) {
    return null;
  }

  const allowSet = new Set(allow);
  const operatorNew = operators.flatMap((op) => {
    const label = op.displayName.trim() || op.name;
    return op.telegram.filter((id) => id && !allowSet.has(id)).map((id) => ({ id, label }));
  });
  const operatorIds = new Set(operatorNew.map((o) => o.id));
  const seenNew = (snap.seen ?? []).filter((s) => !allowSet.has(s.id) && !operatorIds.has(s.id));
  const locked = busy || readOnly;

  function addNumeric(raw: string) {
    const id = raw.trim();
    setAddErr(null);
    if (!id) {
      return;
    }
    if (id.startsWith("@") || /[a-zA-Z]/.test(id)) {
      setAddErr("need a numeric id, not @username — Telegram Desktop experimental Show Peer IDs, or @userinfobot");
      return;
    }
    const ids = parseAllowlist(id);
    if (ids.length === 0) {
      setAddErr("need a numeric id");
      return;
    }
    setAllow((cur) => parseAllowlist([...cur, ...ids]));
    setAddId("");
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const res = await yardFetch(`/api/gantries/${slug}/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      if (body.op === "allowlist") {
        onEnvWritten?.();
      }
    }
  }

  return (
    <DashFold
      title="Telegram"
      persistKey={craneFoldKey(slug, "telegram")}
      shot="telegram"
      summary={
        snap.bot?.username ? (
          `@${snap.bot.username}`
        ) : snap.tokenSet ? (
          "token set"
        ) : (
          <span className="text-amber-200">no token</span>
        )
      }
      hint="profile, /new, allowlist"
      aside={
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          refresh
        </button>
      }
    >
      <p className="mb-3 text-xs text-zinc-600">
        BotFather minted the token. Name, about, commands, and photo (above) go through the Bot API. Allowlist is{" "}
        <code className="text-zinc-500">TELEGRAM_ALLOWED_USERS</code> — recreate after save.
      </p>

      {!snap.tokenSet ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-200">Paste TELEGRAM_BOT_TOKEN in Secrets, then refresh.</p>
          {readOnly ? null : <BotFatherHint slug={slug} />}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-300">
            {snap.bot?.username ? (
              <>
                <span className="font-medium text-stone-100">@{snap.bot.username}</span>
                {snap.bot.id ? <span className="ml-2 text-xs text-zinc-500">id {snap.bot.id}</span> : null}
                {snap.link ? (
                  <>
                    {" · "}
                    <a className="text-amber-200 underline" href={snap.link} target="_blank" rel="noreferrer">
                      open on phone
                    </a>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-amber-200">{snap.detail || "could not reach Telegram"}</span>
            )}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <HintField label="name" {...HINTS.tgName}>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={64}
                value={name}
                disabled={readOnly}
                onChange={(e) => setName(e.target.value)}
              />
            </HintField>
            <HintField label="about (profile)" {...HINTS.tgAbout}>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={120}
                value={about}
                disabled={readOnly}
                onChange={(e) => setAbout(e.target.value)}
              />
            </HintField>
            <HintField label="description (empty chat)" className="sm:col-span-2" {...HINTS.tgDescription}>
              <textarea
                className="min-h-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={512}
                value={description}
                disabled={readOnly}
                onChange={(e) => setDescription(e.target.value)}
              />
            </HintField>
            <HintField label="commands" className="sm:col-span-2" {...HINTS.tgCommands}>
              <textarea
                className="min-h-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-sm text-stone-100"
                value={commands}
                disabled={readOnly}
                onChange={(e) => setCommands(e.target.value)}
                placeholder={"new - Distill this thread and start fresh\ntools - list granted MCP\nauth - start OAuth"}
              />
            </HintField>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void post({
                  op: "profile",
                  name,
                  description,
                  shortDescription: about,
                  commands: ensureTelegramNew(parseCommandLines(commands)),
                })
              }
              className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
            >
              Push profile
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                const next = ensureTelegramNew(parseCommandLines(commands));
                setCommands(formatCommandLines(next));
                void post({ op: "profile", commands: next });
              }}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
            >
              Put /new in / menu
            </button>
          </div>
        </>
      )}

      {snap.tokenSet ? (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Fresh thread</h3>
          <p className="mt-1 text-xs text-zinc-600">
            <code className="text-zinc-500">/new</code> distills the chat into <code className="text-zinc-500">SELF.md</code>, then
            drops history. Telegram will not let this console send as her — she gets a one-tap{" "}
            <code className="text-zinc-500">/new</code> in that DM. Container RAM is gantry + MCP children, not the image; a long
            thread is prompt tokens, extra tools stay until you revoke.
          </p>
          {allow.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">save an allowlist id first</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {allow.map((id) => {
                const op = operators.find((o) => o.telegram.includes(id));
                const label = (op?.displayName.trim() || op?.name || id).trim();
                const seen = snap.seen.find((s) => s.id === id);
                return (
                  <li key={`new:${id}`}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => void post({ op: "new", id })}
                      className="rounded border border-amber-900/70 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
                    >
                      ask {label} to tap /new
                      {seen ? <span className="ml-1 text-zinc-500">{seen.turns}t</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-5 border-t border-zinc-800 pt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Allowlist</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Numeric user ids only. First id: Telegram Desktop → Settings → Advanced → Experimental → Show Peer IDs, or
          message @userinfobot. Later ids show up here after they talk (slog <code className="text-zinc-500">user_id</code>
          ).
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {allow.length === 0 ? <li className="text-xs text-zinc-600">none yet</li> : null}
          {allow.map((id) => (
            <li key={id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => setAllow((cur) => cur.filter((x) => x !== id))}
                className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-stone-100 hover:border-red-800 hover:text-red-200 disabled:opacity-50"
                title="remove"
              >
                {id} ×
              </button>
            </li>
          ))}
        </ul>
        {operatorNew.length ? (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">operators</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">from Profile — save allowlist, then recreate</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {operatorNew.map((o) => (
                <li key={`${o.label}:${o.id}`}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => addNumeric(o.id)}
                    className="rounded border border-amber-900/70 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
                  >
                    add {o.label}
                    <span className="ml-1 text-zinc-500">{o.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {seenNew.length ? (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">seen talking</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {seenNew.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => addNumeric(s.id)}
                    className="rounded border border-amber-900/70 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
                  >
                    add {s.id}
                    <span className="ml-1 text-zinc-500">{s.turns}t</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-40 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="numeric id"
            value={addId}
            disabled={readOnly}
            onChange={(e) => {
              setAddId(e.target.value);
              setAddErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNumeric(addId);
              }
            }}
          />
          <button
            type="button"
            disabled={locked || !addId.trim()}
            onClick={() => addNumeric(addId)}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            add
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void post({ op: "allowlist", ids: allow })}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            Save allowlist
          </button>
        </div>
        {addErr ? <p className="mt-2 text-xs text-amber-200">{addErr}</p> : null}
      </div>
    </DashFold>
  );
}
