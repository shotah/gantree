"use client";

import Link from "next/link";
import {
  boardKindLabel,
  displayBoardName,
  formatBoardScore,
} from "@/lib/yard/host/boardFormat";
import type { BoardChallenge, BoardNotice, BoardRosterEntry, BoardSnapshot } from "@/lib/yard/types";

const CARD
  = "block h-full min-h-56 min-w-0 max-w-full rounded-lg border border-line bg-panel/60 p-4 transition hover:border-accent-line max-sm:p-5";

const SHOW_OPEN = 3;
const SHOW_PINS = 2;

export function BoardsAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-track text-accent`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="6" width="14" height="13" rx="1.4" />
        <path d="M9 6V5M15 6V5M8 11h8M8 15h5" />
      </svg>
    </span>
  );
}

function ScoreLine({
  challenge,
  roster,
}: {
  challenge: BoardChallenge;
  roster: BoardRosterEntry[];
}) {
  const ranked = [...challenge.scores].sort((a, b) => b.value - a.value);
  if (ranked.length === 0) {
    return <span className="text-faint">no check-ins</span>;
  }
  return (
    <span className="min-w-0 truncate">
      {ranked
        .map((s) => `${displayBoardName(roster, s.author)} ${formatBoardScore(challenge.kind, s.value)}`)
        .join(" · ")}
    </span>
  );
}

export function BoardsCard({ board, ready }: { board?: BoardSnapshot; ready: boolean }) {
  let body;
  if (!ready) {
    body = <p className="mt-3 text-sm text-dim">Reading the corkboard…</p>;
  } else if (!board || board.empty) {
    body = <p className="mt-3 text-sm text-dim">Empty corkboard.</p>;
  } else {
    body = <BoardsBody board={board} />;
  }
  return (
    <Link href="/boards" className={CARD} data-shot="boards">
      <h2 className="flex min-w-0 items-center gap-2 font-semibold text-fg max-sm:text-lg">
        <BoardsAvatar />
        Boards
      </h2>
      {body}
    </Link>
  );
}

function BoardsBody({ board }: { board: BoardSnapshot }) {
  const shown = board.open.slice(0, SHOW_OPEN);
  const extra = board.open.length - shown.length;
  const pins = board.pins.slice(0, SHOW_PINS);
  const extraPins = board.pins.length - pins.length;
  return (
    <>
      {board.roster.length
        ? (
            <ul className="mt-3 flex flex-wrap gap-1">
              {board.roster.map((r) => (
                <li
                  key={r.author}
                  className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted"
                  title={r.author}
                >
                  {r.userName || r.agentName || r.author}
                  {r.userName && r.agentName
                    ? (
                        <span className="text-faint">
                          {" "}
                          ·
                          {r.agentName}
                        </span>
                      )
                    : null}
                </li>
              ))}
            </ul>
          )
        : <p className="mt-3 text-xs text-dim">No roster yet.</p>}
      {shown.length
        ? (
            <ul className="mt-3 space-y-2">
              {shown.map((c) => (
                <li key={c.id} className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{c.title}</p>
                  <p className="truncate text-[11px] text-dim">
                    <ScoreLine challenge={c} roster={board.roster} />
                  </p>
                  <p className="truncate text-[10px] text-faint">
                    {boardKindLabel(c.kind)}
                    {c.windowStart && c.windowEnd ? ` · ${c.windowStart} → ${c.windowEnd}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )
        : <p className="mt-3 text-xs text-dim">No open challenges.</p>}
      {extra > 0
        ? (
            <p className="mt-2 text-[10px] text-faint">
              +
              {extra}
              {" "}
              more open
            </p>
          )
        : null}
      {pins.length
        ? (
            <ul className="mt-3 space-y-1.5">
              {pins.map((p) => (
                <PinLine key={p.id} pin={p} roster={board.roster} />
              ))}
            </ul>
          )
        : null}
      {extraPins > 0
        ? (
            <p className="mt-1 text-[10px] text-faint">
              +
              {extraPins}
              {" "}
              more pins
            </p>
          )
        : null}
    </>
  );
}

function PinLine({ pin, roster }: { pin: BoardNotice; roster: BoardRosterEntry[] }) {
  return (
    <li className="min-w-0">
      <p className="truncate text-sm text-fg">{pin.body}</p>
      <p className="truncate text-[10px] text-faint">
        {displayBoardName(roster, pin.author)}
        {" "}
        · pin
      </p>
    </li>
  );
}
