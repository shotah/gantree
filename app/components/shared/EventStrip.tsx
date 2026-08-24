"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { YardEvent } from "@/lib/yard/types";
import { fmtAgo, fmtSpendWindow, type SpendWindow } from "@/lib/yard/observe/spend";
import { craneFoldKey, craneLayoutKey, DashFold } from "./DashFold";
import { useDoor } from "./DoorShell";
import { yardFetch } from "@/app/lib/yardFetch";
import { SpendScope } from "../yard/SpendBoard";

const EVENT_KINDS = [
  "setup",
  "login",
  "logout",
  "start",
  "stop",
  "recreate",
  "pin",
  "backup",
  "clone",
  "grant",
  "revoke",
  "env",
  "tags",
  "allowlist",
  "telegram-profile",
  "telegram-new",
  "operator-add",
  "operator-remove",
  "operator-access",
  "operator-profile",
  "operator-avatar",
  "passphrase",
  "inventory",
] as const;

const EVENT_WINDOW_DEFAULT: SpendWindow = "7d";
const EVENT_LIST_LIMIT = 100;
const EVENT_JSONL_LIMIT = 200;

function fmtEventAt(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) {
    return at;
  }
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EventRow({ e, craneSlug }: { e: YardEvent; craneSlug?: string }) {
  const atMs = Date.parse(e.at);
  const when = Number.isNaN(atMs) ? e.at : fmtEventAt(e.at);
  const ago = Number.isNaN(atMs) ? e.at : fmtAgo(atMs);
  const crane
    = craneSlug
      ? null
      : e.slug
        ? (
            <Link href={`/gantries/${e.slug}`} className="truncate text-accent/90 hover:text-accent-hover sm:col-start-4">
              {e.slug}
            </Link>
          )
        : (
            <span className="hidden text-faint sm:col-start-4 sm:inline">—</span>
          );
  return (
    <li
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 py-2.5 sm:gap-x-3 sm:gap-y-0.5 sm:py-2 ${
        craneSlug
          ? "sm:grid-cols-[minmax(0,8.5rem)_minmax(0,6.5rem)_auto_minmax(0,1fr)]"
          : "sm:grid-cols-[minmax(0,8.5rem)_minmax(0,6.5rem)_auto_minmax(0,5.5rem)_minmax(0,1fr)]"
      }`}
    >
      <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-2 sm:contents">
        <span className="min-w-0 truncate font-medium text-fg sm:col-start-3">{e.kind}</span>
        <time
          className="shrink-0 tabular-nums text-dim sm:col-start-1"
          dateTime={e.at}
          title={Number.isNaN(atMs) ? e.at : new Date(e.at).toLocaleString()}
        >
          <span className="sm:hidden">{ago}</span>
          <span className="hidden sm:inline">{when}</span>
        </time>
      </div>
      <div className="col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:contents">
        <span className="truncate text-mark/80 sm:col-start-2">{e.operatorName ?? "—"}</span>
        {crane}
        {e.detail
          ? (
              <span className={`min-w-0 break-words text-dim ${craneSlug ? "sm:col-start-4" : "sm:col-start-5"}`}>
                {e.detail}
              </span>
            )
          : null}
      </div>
    </li>
  );
}

function eventQuery(opts: { slug?: string; kind: string; window: SpendWindow; limit: number; format?: "jsonl" }): string {
  const q = new URLSearchParams({
    limit: String(opts.limit),
    window: opts.window,
  });
  if (opts.slug) {
    q.set("slug", opts.slug);
  }
  if (opts.kind) {
    q.set("kind", opts.kind);
  }
  if (opts.format) {
    q.set("format", opts.format);
  }
  return q.toString();
}

export function EventStrip({ slug, fold }: { slug?: string; fold?: boolean }) {
  const { operator } = useDoor();
  const [events, setEvents] = useState<YardEvent[]>([]);
  const [kind, setKind] = useState("");
  const [eventWindow, setEventWindow] = useState<SpendWindow>(EVENT_WINDOW_DEFAULT);
  const kinds = EVENT_KINDS.filter((k) => (k !== "login" && k !== "logout") || (operator?.role === "admin" && !slug));
  const scope = fmtSpendWindow(eventWindow);
  const folded = Boolean(slug || fold);

  const load = useCallback(() => {
    yardFetch(`/api/events?${eventQuery({ slug, kind, window: eventWindow, limit: EVENT_LIST_LIMIT })}`)
      .then((r) => r.json())
      .then((d: { events?: YardEvent[] }) => setEvents(d.events ?? []))
      .catch(() => undefined);
  }, [slug, kind, eventWindow]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const downloadJsonl = useCallback(async () => {
    const r = await yardFetch(`/api/events?${eventQuery({ slug, kind, window: eventWindow, limit: EVENT_JSONL_LIMIT, format: "jsonl" })}`);
    if (!r.ok) {
      return;
    }
    const blob = await r.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "yard-events.jsonl";
    a.click();
    URL.revokeObjectURL(href);
  }, [slug, kind, eventWindow]);

  const empty = kind ? `no ${kind} events in ${scope}` : `No events in ${scope}`;
  const summary = events.length === 0 ? `none in ${scope}` : `${events.length} in ${scope}`;

  const list
    = events.length === 0
      ? (
          <p className="px-3 py-6 text-center text-xs text-faint">{empty}</p>
        )
      : (
          <ul className="min-w-0 divide-y divide-line/80 text-xs text-dim max-sm:text-sm">
            {events.map((e) => (
              <EventRow key={e.id} e={e} craneSlug={slug} />
            ))}
          </ul>
        );

  return (
    <DashFold
      title={slug ? "Events on this crane" : "Yard events"}
      persistKey={slug ? craneLayoutKey("events") : craneFoldKey(fold ? "host" : "yard", "events")}
      defaultOpen={!folded}
      hint={slug ? "start, stop, grant, pin — not slog" : "who mutated inventory, operators, cranes — logins admin-only"}
      summary={summary}
      aside={<SpendScope window={eventWindow} onWindow={setEventWindow} />}
    >
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-wide text-faint">
          kind
          <select
            aria-label="Event kind"
            className="min-w-0 rounded border border-line bg-canvas px-1.5 py-0.5 text-xs normal-case text-body"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">all</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-[10px] uppercase tracking-wide text-dim hover:text-body max-sm:min-h-11 max-sm:px-2"
          onClick={() => void downloadJsonl()}
        >
          jsonl
        </button>
      </div>
      <div
        className="max-h-[28rem] min-w-0 overflow-auto rounded-md border border-line/80 bg-canvas/50 px-3 max-sm:max-h-[20rem] max-sm:px-2.5"
        role="log"
        aria-label="Yard events"
      >
        {list}
      </div>
    </DashFold>
  );
}
