"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LogLine, LogTurnGroup } from "@/lib/yard/types";
import { yardFetch } from "../lib/yardFetch";

function groupLogsByTurn(lines: LogLine[]): LogTurnGroup[] {
  const groups: LogTurnGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.turnId === line.turnId) {
      last.lines.push(line);
    } else {
      groups.push({ turnId: line.turnId, lines: [line] });
    }
  }
  return groups;
}

const KIND_CLASS: Record<LogLine["kind"], string> = {
  error: "text-red-300",
  skip: "text-amber-300",
  tool: "text-sky-300",
  turn: "text-emerald-300",
  info: "text-zinc-400",
};

function LineRow({ l }: { l: LogLine }) {
  return (
    <div className={KIND_CLASS[l.kind]}>
      <span className="mr-2 text-zinc-600">{l.ts ? new Date(l.ts).toLocaleTimeString() : ""}</span>
      <span className="mr-2 uppercase text-zinc-500">{l.level ?? l.kind}</span>
      <span>{l.msg}</span>
    </div>
  );
}

export function LogViewer({ slug }: { slug: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [follow, setFollow] = useState(true);
  const [groupTurns, setGroupTurns] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    yardFetch(`/api/gantries/${slug}/logs?tail=200`)
      .then((r) => r.json())
      .then((data: { lines?: LogLine[]; error?: string }) => {
        if (!cancelled && data.lines) {
          setLines(data.lines);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) {
          return;
        }
        es = new EventSource(`/api/gantries/${slug}/logs?tail=0&follow=1`);
        es.onmessage = (ev) => {
          try {
            const line = JSON.parse(ev.data) as LogLine;
            setLines((prev) => {
              const next = [...prev, line];
              return next.length > 800 ? next.slice(-800) : next;
            });
          } catch {
            /* ignore */
          }
        };
      });
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [slug]);

  useEffect(() => {
    if (follow) {
      bottom.current?.scrollIntoView({ block: "end" });
    }
  }, [lines, follow]);

  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    return lines.filter((l) => {
      if (level !== "all" && l.kind !== level) {
        return false;
      }
      if (needle && !`${l.msg} ${l.raw} ${l.turnId ?? ""}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [lines, q, level]);

  const groups = useMemo(() => (groupTurns ? groupLogsByTurn(shown) : null), [shown, groupTurns]);
  const hasTurnIds = shown.some((l) => l.turnId);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <input
          className="min-w-40 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
          placeholder="search logs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">all</option>
          <option value="error">error</option>
          <option value="skip">skip</option>
          <option value="tool">tool</option>
          <option value="turn">turn</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          follow
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-500" title={hasTurnIds ? undefined : "no turn id in slog yet — groups stay flat"}>
          <input type="checkbox" checked={groupTurns} onChange={(e) => setGroupTurns(e.target.checked)} />
          group by turn
        </label>
        <span className="text-xs text-zinc-600">{shown.length} lines</span>
      </div>
      <div className="max-h-[28rem] overflow-auto p-3 text-xs leading-5">
        {groups
          ? groups.map((g, gi) => {
              const key = `${g.turnId ?? "plain"}-${gi}`;
              const shut = collapsed[key];
              return (
                <div key={key} className="mb-1">
                  <button
                    type="button"
                    className="mb-0.5 text-left text-[10px] uppercase tracking-wide text-zinc-600 hover:text-zinc-400"
                    onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  >
                    {shut ? "▸" : "▾"} {g.turnId ? `turn ${g.turnId}` : "untagged"} · {g.lines.length}
                  </button>
                    {shut ? null : g.lines.map((l, i) => <LineRow key={`${l.ts}-${i}`} l={l} />)}
                </div>
              );
            })
          : shown.map((l, i) => <LineRow key={`${l.ts}-${i}`} l={l} />)}
        <div ref={bottom} />
      </div>
    </div>
  );
}
