"use client";

import { useCallback, useEffect, useState } from "react";
import type { YardEvent } from "@/lib/yard/types";
import { craneFoldKey, DashFold } from "./DashFold";
import { useDoor } from "./DoorShell";
import { yardFetch } from "../lib/yardFetch";

const EVENT_KINDS = [
  "setup",
  "login",
  "logout",
  "start",
  "stop",
  "recreate",
  "pin",
  "backup",
  "grant",
  "revoke",
  "env",
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

export function EventStrip({ slug, fold }: { slug?: string; fold?: boolean }) {
  const { operator } = useDoor();
  const [events, setEvents] = useState<YardEvent[]>([]);
  const [kind, setKind] = useState("");
  const kinds = EVENT_KINDS.filter((k) => (k !== "login" && k !== "logout") || (operator?.role === "admin" && !slug));

  const load = useCallback(() => {
    const q = new URLSearchParams({ limit: slug ? "20" : "12" });
    if (slug) {
      q.set("slug", slug);
    }
    if (kind) {
      q.set("kind", kind);
    }
    yardFetch(`/api/events?${q}`)
      .then((r) => r.json())
      .then((d: { events?: YardEvent[] }) => setEvents(d.events ?? []))
      .catch(() => undefined);
  }, [slug, kind]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const downloadJsonl = useCallback(async () => {
    const q = new URLSearchParams({ limit: "200", format: "jsonl" });
    if (slug) {
      q.set("slug", slug);
    }
    if (kind) {
      q.set("kind", kind);
    }
    const r = await yardFetch(`/api/events?${q}`);
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
  }, [slug, kind]);

  const filter = (
    <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-600">
      kind
      <select
        aria-label="Event kind"
        className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-xs normal-case text-zinc-300"
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
  );

  const list =
    events.length === 0 ? (
      <p className="text-xs text-zinc-600">{kind ? `no ${kind} events` : "no events yet"}</p>
    ) : (
      <ul className="space-y-1 text-xs text-zinc-500 max-sm:space-y-2 max-sm:text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-zinc-600">{new Date(e.at).toLocaleString()}</span>
            <span className="text-amber-200/80">{e.operatorName ?? "—"}</span>
            <span className="text-zinc-300">{e.kind}</span>
            {e.slug && !slug ? <span>{e.slug}</span> : null}
            {e.detail ? <span className="truncate text-zinc-500">{e.detail}</span> : null}
          </li>
        ))}
      </ul>
    );

  if (slug) {
    return (
      <DashFold
        title="Recent on this crane"
        persistKey={craneFoldKey(slug, "events")}
        summary={events.length === 0 ? "no events" : `${events.length} event${events.length === 1 ? "" : "s"}`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {filter}
          <button type="button" className="text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300" onClick={() => void downloadJsonl()}>
            jsonl
          </button>
        </div>
        {list}
      </DashFold>
    );
  }

  if (fold) {
    return (
      <DashFold
        title="Yard events"
        persistKey={craneFoldKey("host", "events")}
        summary={events.length === 0 ? "no events" : `${events.length} event${events.length === 1 ? "" : "s"}`}
        hint="who mutated inventory, operators, cranes — logins admin-only"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {filter}
          <button type="button" className="text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300" onClick={() => void downloadJsonl()}>
            jsonl
          </button>
        </div>
        {list}
      </DashFold>
    );
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-400">Yard events</h2>
        <div className="flex flex-wrap items-center gap-3">
          {filter}
          <button type="button" className="text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300" onClick={() => void downloadJsonl()}>
            jsonl
          </button>
        </div>
      </div>
      {list}
    </section>
  );
}
