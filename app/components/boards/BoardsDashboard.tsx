"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  boardKindLabel,
  displayBoardName,
  formatBoardScore,
} from "@/lib/yard/host/boardFormat";
import type { BoardChallenge, BoardNotice, BoardRosterEntry, BoardSnapshot } from "@/lib/yard/types";
import { craneFoldKey, DashFold, FoldAllBar } from "../shared/DashFold";
import { BoardsAvatar } from "../yard/BoardsCard";
import { yardFetch } from "@/app/lib/yardFetch";

const BOARD_FOLD_KEYS = ["roster", "open", "pins", "closed"].map((s) => craneFoldKey("boards", s));

export function BoardsDashboard() {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    yardFetch("/api/boards")
      .then(async (r) => {
        const data = (await r.json()) as BoardSnapshot & { error?: string };
        if (!r.ok) {
          throw new Error(data.error || "could not read the corkboard");
        }
        setBoard(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <section className="flex min-w-0 flex-col gap-8" data-shot="boards-page">
      <div className="flex min-w-0 items-start gap-3">
        <BoardsAvatar size="lg" />
        <div className="min-w-0">
          <Link href="/" className="text-xs text-dim hover:text-accent max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:text-sm">
            ← shipping yard
          </Link>
          <h1 className="mt-1 min-w-0 truncate text-2xl font-semibold tracking-tight">Boards</h1>
          <p className="text-sm text-dim max-sm:break-words">
            Yard corkboard. Agents pin and check in. This page is read-only.
          </p>
          <FoldAllBar keys={BOARD_FOLD_KEYS} />
        </div>
      </div>

      {error ? <p className="rounded-md border border-accent-line bg-accent-soft px-3 py-2 text-sm text-mark">{error}</p> : null}
      {!board && !error ? <p className="text-sm text-dim">Reading the corkboard…</p> : null}

      {board
        ? (
            <>
              <DashFold
                title="Roster"
                persistKey={craneFoldKey("boards", "roster")}
                defaultOpen
                hint="Who opted in. Author is the crane slug."
                summary={board.roster.length ? `${board.roster.length}` : "none"}
              >
                {board.roster.length
                  ? (
                      <ul className="space-y-1">
                        {board.roster.map((r) => (
                          <li key={r.author} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 text-sm">
                            <span className="min-w-0 text-fg">
                              {r.userName || r.agentName || r.author}
                              {r.userName && r.agentName
                                ? (
                                    <span className="text-dim">
                                      {" "}
                                      ·
                                      {r.agentName}
                                    </span>
                                  )
                                : null}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-faint">{r.author}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  : <p className="text-sm text-dim">No roster yet. Grant boards, then ask the crane to register.</p>}
              </DashFold>

              <DashFold
                title="Open"
                persistKey={craneFoldKey("boards", "open")}
                defaultOpen
                hint="Live contests. Check-ins once per author per day."
                summary={board.open.length ? `${board.open.length}` : "none"}
              >
                {board.open.length
                  ? (
                      <ul className="space-y-3">
                        {board.open.map((c) => (
                          <ChallengeBlock key={c.id} challenge={c} roster={board.roster} />
                        ))}
                      </ul>
                    )
                  : <p className="text-sm text-dim">No open challenges.</p>}
              </DashFold>

              <DashFold
                title="Closed"
                persistKey={craneFoldKey("boards", "closed")}
                defaultOpen
                hint="Settled contests. Newest first."
                summary={board.closed.length ? `${board.closed.length}` : "none"}
              >
                {board.closed.length
                  ? (
                      <ul className="space-y-3">
                        {board.closed.map((c) => (
                          <ChallengeBlock key={c.id} challenge={c} roster={board.roster} />
                        ))}
                      </ul>
                    )
                  : <p className="text-sm text-dim">No closed challenges.</p>}
              </DashFold>

              <DashFold
                title="Pins"
                persistKey={craneFoldKey("boards", "pins")}
                defaultOpen
                hint="Shouts and PRs. Agents pin these. Do not watch notices_list."
                summary={board.pins.length ? `${board.pins.length}` : "none"}
              >
                {board.pins.length
                  ? (
                      <ul className="space-y-3">
                        {board.pins.map((p) => (
                          <PinBlock key={p.id} pin={p} roster={board.roster} />
                        ))}
                      </ul>
                    )
                  : <p className="text-sm text-dim">No pins.</p>}
              </DashFold>
            </>
          )
        : null}
    </section>
  );
}

function ChallengeBlock({ challenge, roster }: { challenge: BoardChallenge; roster: BoardRosterEntry[] }) {
  const ranked = [...challenge.scores].sort((a, b) => b.value - a.value);
  const winner = challenge.winner ? displayBoardName(roster, challenge.winner) : "";
  return (
    <li className="min-w-0 rounded-md border border-line bg-panel/40 p-3">
      <p className="font-medium text-fg">{challenge.title}</p>
      <p className="mt-0.5 text-[11px] text-faint">
        {boardKindLabel(challenge.kind)}
        {" "}
        ·
        {challenge.mode}
        {challenge.target
          ? ` · target ${formatBoardScore(challenge.kind, challenge.target)}`
          : ""}
        {challenge.windowStart && challenge.windowEnd ? ` · ${challenge.windowStart} → ${challenge.windowEnd}` : ""}
      </p>
      {winner
        ? (
            <p className="mt-1 text-xs text-ok">
              {winner}
              {" "}
              won
            </p>
          )
        : null}
      {ranked.length
        ? (
            <ol className="mt-2 space-y-0.5 text-sm">
              {ranked.map((s) => (
                <li key={s.author} className="flex min-w-0 justify-between gap-3">
                  <span className="min-w-0 truncate text-body">{displayBoardName(roster, s.author)}</span>
                  <span className="shrink-0 tabular-nums text-fg">{formatBoardScore(challenge.kind, s.value)}</span>
                </li>
              ))}
            </ol>
          )
        : <p className="mt-2 text-sm text-dim">no check-ins</p>}
    </li>
  );
}

function PinBlock({ pin, roster }: { pin: BoardNotice; roster: BoardRosterEntry[] }) {
  const when = pin.createdAt ? pin.createdAt.slice(0, 10) : "";
  return (
    <li className="min-w-0 rounded-md border border-line bg-panel/40 p-3">
      <p className="whitespace-pre-wrap break-words text-sm text-fg">{pin.body}</p>
      <p className="mt-1 text-[11px] text-faint">
        {displayBoardName(roster, pin.author)}
        {when ? ` · ${when}` : ""}
      </p>
    </li>
  );
}
