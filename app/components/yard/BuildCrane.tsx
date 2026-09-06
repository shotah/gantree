"use client";

import { useEffect, useState } from "react";
import { HINTS } from "@/lib/yard/hints";
import { secretLook } from "@/lib/yard/secretLook";
import { parseAllowlist } from "@/lib/yard/host/telegram";
import {
  formatPendantEntry,
  operatorOnPendantList,
  parsePendantAllowlist,
  pendantEntryForOperator,
} from "@/lib/yard/crane/pendantShape";
import { BotFatherHint } from "../crane/BotFatherHint";
import { HintField } from "../shared/HintField";
import { yardFetch } from "@/app/lib/yardFetch";

type BuildOperator = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  channels?: { telegram?: string[]; google?: string[] };
};

export function BuildCrane({ onBuilt }: { onBuilt: () => void }) {
  const [open, setOpen] = useState(false);
  const [yard, setYard] = useState<"home" | "cloud">("home");
  const [slug, setSlug] = useState("");
  const [profile, setProfile] = useState<"slim" | "life" | "life-cast">("slim");
  const [model, setModel] = useState("gemini-3.6-flash");
  const [channel, setChannel] = useState("telegram");
  const [token, setToken] = useState("");
  const [allow, setAllow] = useState("");
  const [mailbox, setMailbox] = useState("");
  const [bearer, setBearer] = useState("");
  const [bot, setBot] = useState<{ username: string | null; link: string | null; firstName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [operators, setOperators] = useState<BuildOperator[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: BuildOperator[] }) => {
        setOperators(d.operators ?? []);
      })
      .catch(() => undefined);
  }, [open]);

  async function probeToken(value: string): Promise<boolean> {
    const t = value.trim();
    if (!t) {
      setBot(null);
      return true;
    }
    const res = await yardFetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      detail?: string;
      bot?: { username: string | null; firstName: string };
      link?: string | null;
    };
    if (!res.ok || !data.bot) {
      setBot(null);
      setErr(data.detail || "token did not getMe");
      return false;
    }
    setBot({ username: data.bot.username, firstName: data.bot.firstName, link: data.link ?? null });
    setErr(null);
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    if (channel === "telegram" && token.trim()) {
      const ok = await probeToken(token);
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    const env: Record<string, string> = {};
    if (channel === "telegram") {
      env.TELEGRAM_BOT_TOKEN = token;
      env.TELEGRAM_ALLOWED_USERS = allow;
    }
    if (channel === "pendant") {
      env.PENDANT_MAILBOX_URL = mailbox;
      env.PENDANT_BEARER = bearer;
      env.PENDANT_ALLOWED_USERS = allow;
    }
    const res = await yardFetch("/api/gantries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, yard, profile, model, channel, env }),
    });
    const data = (await res.json()) as { ok?: boolean; detail?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(data.detail || "could not build crane");
      return;
    }
    setOpen(false);
    setSlug("");
    setToken("");
    setAllow("");
    setMailbox("");
    setBearer("");
    setBot(null);
    onBuilt();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-mark hover:border-accent max-sm:w-full max-sm:py-2.5 max-sm:text-sm"
      >
        Build a crane
      </button>
    );
  }

  const tokenLook = secretLook({ set: false, secret: true }, token, "token");
  const bearerLook = secretLook({ set: false, secret: true }, bearer, "token");

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel/70 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-fg">New crane</h2>
        <button type="button" className="text-xs text-dim max-sm:min-h-11 max-sm:px-2 max-sm:text-sm" onClick={() => setOpen(false)}>
          cancel
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <HintField label="Yard first" {...HINTS.buildYard}>
          <select className="rounded border border-edge bg-canvas px-2 py-1" value={yard} onChange={(e) => setYard(e.target.value as "home" | "cloud")}>
            <option value="home">home Mini</option>
            <option value="cloud">cloud VM</option>
          </select>
        </HintField>
        <HintField label="slug" {...HINTS.buildSlug}>
          <input required className="rounded border border-edge bg-canvas px-2 py-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="kit" />
        </HintField>
        <HintField label="profile" {...HINTS.buildProfile}>
          <select
            className="rounded border border-edge bg-canvas px-2 py-1"
            value={profile}
            onChange={(e) => setProfile(e.target.value as "slim" | "life" | "life-cast")}
          >
            <option value="slim">slim (search + math)</option>
            <option value="life">life</option>
            <option value="life-cast" disabled={yard === "cloud"}>
              life-cast (home only)
            </option>
          </select>
        </HintField>
        <HintField label="model" {...HINTS.buildModel}>
          <input className="rounded border border-edge bg-canvas px-2 py-1" value={model} onChange={(e) => setModel(e.target.value)} />
        </HintField>
        <HintField label="channel" {...HINTS.buildChannel}>
          <select className="rounded border border-edge bg-canvas px-2 py-1" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="telegram">telegram</option>
            <option value="discord">discord</option>
            <option value="slack">slack</option>
            <option value="pendant">pendant</option>
            <option value="stdio">stdio (dev)</option>
          </select>
        </HintField>
        {channel === "telegram"
          ? (
              <>
                <HintField label="bot token" {...HINTS.botToken}>
                  <input
                    className={`rounded border bg-canvas px-2 py-1 ${
                      tokenLook.missing ? "border-accent-line placeholder:text-mark/90" : "border-edge"
                    }`}
                    type={tokenLook.type}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={tokenLook.placeholder}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setBot(null);
                    }}
                  />
                </HintField>
                <div className="sm:col-span-2">
                  <BotFatherHint slug={slug} />
                </div>
                <HintField label="allowlist" className="sm:col-span-2" {...HINTS.allowlist}>
                  <input className="rounded border border-edge bg-canvas px-2 py-1" value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="123456789" />
                </HintField>
                <OperatorAllowChecks
                  className="sm:col-span-2"
                  operators={operators.filter((o) => (o.channels?.telegram ?? []).length > 0)}
                  checked={(op) => {
                    const have = new Set(parseAllowlist(allow));
                    return (op.channels?.telegram ?? []).every((id) => have.has(id));
                  }}
                  onToggle={(op, on) => {
                    const ids = op.channels?.telegram ?? [];
                    if (on) {
                      setAllow(parseAllowlist([allow, ...ids]).join(","));
                      return;
                    }
                    const drop = new Set(ids);
                    setAllow(parseAllowlist(allow).filter((id) => !drop.has(id)).join(","));
                  }}
                  extra={(op) => (op.channels?.telegram ?? []).join(", ")}
                />
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={busy || !token.trim()}
                    onClick={() => void probeToken(token)}
                    className="rounded border border-edge px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
                  >
                    check token
                  </button>
                  {bot
                    ? (
                        <p className="text-xs text-muted">
                          {bot.username ? `@${bot.username}` : bot.firstName}
                          {bot.link
                            ? (
                                <>
                                  {" · "}
                                  <a className="text-mark underline" href={bot.link} target="_blank" rel="noreferrer">
                                    open on phone
                                  </a>
                                </>
                              )
                            : null}
                        </p>
                      )
                    : null}
                </div>
              </>
            )
          : null}
        {channel === "pendant"
          ? (
              <>
                <HintField label="mailbox URL" className="sm:col-span-2" {...HINTS.pendantMailbox}>
                  <input
                    className="rounded border border-edge bg-canvas px-2 py-1"
                    value={mailbox}
                    onChange={(e) => setMailbox(e.target.value)}
                    placeholder="wss://gantry-pendant.example.workers.dev/ws/kit"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </HintField>
                <HintField label="mailbox bearer" {...HINTS.pendantBearer}>
                  <input
                    className={`rounded border bg-canvas px-2 py-1 ${
                      bearerLook.missing ? "border-accent-line placeholder:text-mark/90" : "border-edge"
                    }`}
                    type={bearerLook.type}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={bearerLook.placeholder}
                    value={bearer}
                    onChange={(e) => setBearer(e.target.value)}
                  />
                </HintField>
                <HintField label="pendant allowlist" className="sm:col-span-2" {...HINTS.pendantAllowlist}>
                  <input
                    className="rounded border border-edge bg-canvas px-2 py-1"
                    value={allow}
                    onChange={(e) => setAllow(e.target.value)}
                    placeholder="ada@example.com"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </HintField>
                <OperatorAllowChecks
                  className="sm:col-span-2"
                  operators={operators.filter((o) => pendantEntryForOperator({ email: o.email, channels: { google: o.channels?.google ?? [] } }).ok)}
                  checked={(op) =>
                    operatorOnPendantList(
                      { email: op.email, channels: { google: op.channels?.google ?? [] } },
                      parsePendantAllowlist(allow),
                    )}
                  onToggle={(op, on) => {
                    const made = pendantEntryForOperator({ email: op.email, channels: { google: op.channels?.google ?? [] } });
                    if (!made.ok) {
                      return;
                    }
                    if (on) {
                      setAllow(parsePendantAllowlist([allow, made.entry]).map(formatPendantEntry).join(","));
                      return;
                    }
                    const email = op.email.trim().toLowerCase();
                    const google = new Set(op.channels?.google ?? []);
                    setAllow(
                      parsePendantAllowlist(allow)
                        .filter((e) => !((e.sub && google.has(e.sub)) || (e.email && email && e.email === email)))
                        .map(formatPendantEntry)
                        .join(","),
                    );
                  }}
                  extra={(op) => op.email || (op.channels?.google ?? [])[0] || ""}
                  badge={(op) => ((op.channels?.google ?? [])[0] ? "sub" : null)}
                />
              </>
            )
          : null}
      </div>
      {err ? <p className="mt-3 text-xs text-danger">{err}</p> : null}
      <button disabled={busy} type="submit" className="mt-4 rounded border border-accent-line px-3 py-1.5 text-xs text-mark disabled:opacity-50">
        {busy ? "building…" : "Build crane"}
      </button>
    </form>
  );
}

function OperatorAllowChecks({
  className,
  operators,
  checked,
  onToggle,
  extra,
  badge,
}: {
  className?: string;
  operators: BuildOperator[];
  checked: (op: BuildOperator) => boolean;
  onToggle: (op: BuildOperator, on: boolean) => void;
  extra: (op: BuildOperator) => string;
  badge?: (op: BuildOperator) => string | null;
}) {
  if (operators.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wide text-faint">operators</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {operators.map((op) => {
          const label = op.displayName.trim() || op.name;
          const mark = badge?.(op);
          return (
            <li key={op.id}>
              <label className="inline-flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-fg">
                <input type="checkbox" checked={checked(op)} onChange={(e) => onToggle(op, e.target.checked)} />
                {label}
                {extra(op)
                  ? (
                      <span className="text-dim">{extra(op)}</span>
                    )
                  : null}
                {mark
                  ? (
                      <span className="rounded border border-edge px-1 text-[10px] text-muted">{mark}</span>
                    )
                  : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
