"use client";

import { useCallback, useEffect, useState } from "react";
import type { YardEvent } from "@/lib/yard/types";
import { yardFetch } from "../lib/yardFetch";

export function EventStrip({ slug }: { slug?: string }) {
  const [events, setEvents] = useState<YardEvent[]>([]);

  const load = useCallback(() => {
    const q = new URLSearchParams({ limit: slug ? "20" : "12" });
    if (slug) {
      q.set("slug", slug);
    }
    yardFetch(`/api/events?${q}`)
      .then((r) => r.json())
      .then((d: { events?: YardEvent[] }) => setEvents(d.events ?? []))
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  if (events.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-zinc-400">{slug ? "Recent on this crane" : "Yard events"}</h2>
      <ul className="space-y-1 text-xs text-zinc-500">
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
    </section>
  );
}
