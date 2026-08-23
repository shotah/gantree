"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatCommandLines,
  parseAllowlist,
  parseCommandLines,
  type TelegramSnapshot,
} from "@/lib/yard/host/telegram";
import { yardFetch } from "../lib/yardFetch";

export function TelegramBot({
  slug,
  busy,
  setBusy,
  onNotice,
  onSaved,
}: {
  slug: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotice: (msg: string) => void;
  onSaved: () => void;
}) {
  const [snap, setSnap] = useState<TelegramSnapshot | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [about, setAbout] = useState("");
  const [commands, setCommands] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [addId, setAddId] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);

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
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!snap?.enabled) {
    return null;
  }

  const allowSet = new Set(allow);
  const seenNew = (snap.seen ?? []).filter((s) => !allowSet.has(s.id));

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
    }
  }

  return (
    <section data-shot="telegram" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-400">Telegram</h2>
          <p className="mt-1 text-xs text-zinc-600">
            BotFather minted the token. Name, about, commands, and photo (above) go through the Bot API. Allowlist is{" "}
            <code className="text-zinc-500">TELEGRAM_ALLOWED_USERS</code> — recreate after save.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          refresh
        </button>
      </div>

      {!snap.tokenSet ? (
        <p className="text-sm text-amber-200">Paste TELEGRAM_BOT_TOKEN in Secrets, then refresh.</p>
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
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              name
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={64}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              about (profile)
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={120}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
              description (empty chat)
              <textarea
                className="min-h-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100"
                maxLength={512}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
              commands (one per line: tools - list granted MCP)
              <textarea
                className="min-h-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-sm text-stone-100"
                value={commands}
                onChange={(e) => setCommands(e.target.value)}
                placeholder={"tools - list granted MCP\nnew - distill memory\nauth - start OAuth"}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void post({
                op: "profile",
                name,
                description,
                shortDescription: about,
                commands: parseCommandLines(commands),
              })
            }
            className="mt-3 rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
          >
            Push profile
          </button>
        </>
      )}

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
                disabled={busy}
                onClick={() => setAllow((cur) => cur.filter((x) => x !== id))}
                className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-stone-100 hover:border-red-800 hover:text-red-200 disabled:opacity-50"
                title="remove"
              >
                {id} ×
              </button>
            </li>
          ))}
        </ul>
        {seenNew.length ? (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">seen talking</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {seenNew.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
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
            disabled={busy || !addId.trim()}
            onClick={() => addNumeric(addId)}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            add
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ op: "allowlist", ids: allow })}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
          >
            Save allowlist
          </button>
        </div>
        {addErr ? <p className="mt-2 text-xs text-amber-200">{addErr}</p> : null}
      </div>
    </section>
  );
}
