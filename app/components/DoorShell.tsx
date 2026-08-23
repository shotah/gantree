"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { OperatorRole } from "@/lib/yard/door/channels";
import { OperatorAvatar } from "./OperatorAvatar";
import { GantreeMark } from "./GantreeMark";

export type DoorOperator = {
  id: string;
  name: string;
  displayName: string;
  role: OperatorRole;
  cranes: string[];
  avatarRev: number | null;
};

type DoorState = {
  ready: boolean;
  operator: DoorOperator | null;
};

const DoorContext = createContext<DoorState>({ ready: false, operator: null });

export function useDoor(): DoorState {
  return useContext(DoorContext);
}

export function DoorShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [door, setDoor] = useState<DoorState | null>(null);

  useEffect(() => {
    let live = true;
    function load() {
      fetch("/api/door", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d: DoorState) => {
          if (live) {
            setDoor(d);
          }
        })
        .catch(() => {
          if (live) {
            setDoor({ ready: false, operator: null });
          }
        });
    }
    load();
    window.addEventListener("gantree-door", load);
    return () => {
      live = false;
      window.removeEventListener("gantree-door", load);
    };
  }, [path]);

  const publicPage = path === "/login" || path === "/setup";
  let allow = false;
  let dest: string | null = null;
  if (door) {
    if (!door.ready) {
      if (path === "/setup") {
        allow = true;
      } else {
        dest = "/setup";
      }
    } else if (!door.operator) {
      if (path === "/login") {
        allow = true;
      } else {
        dest = "/login";
      }
    } else if (publicPage) {
      dest = "/";
    } else {
      allow = true;
    }
  }

  useEffect(() => {
    if (dest) {
      window.location.replace(dest);
    }
  }, [dest]);

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/login");
  }

  const you = door?.operator;
  const label = you ? you.displayName || you.name : "";

  return (
    <DoorContext.Provider value={door ?? { ready: false, operator: null }}>
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-amber-500">
            <GantreeMark className="h-7 w-7 shrink-0" />
            gantree
          </Link>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <p>shipping yard · not the chat</p>
            {you ? (
              <>
                <Link href="/profile" className="flex items-center gap-2 text-zinc-400 hover:text-amber-200">
                  <OperatorAvatar id={you.id} rev={you.avatarRev} name={label} />
                  <span>
                    {label}
                    <span className="ml-1.5 text-zinc-600">{you.role}</span>
                  </span>
                </Link>
                <Link
                  href="/settings"
                  className="text-zinc-400 hover:text-amber-200"
                  aria-label="settings"
                  title="settings"
                >
                  <CogIcon />
                </Link>
                <button type="button" onClick={() => void logout()} className="text-amber-200/80 hover:text-amber-200">
                  log out
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      {allow ? children : <p className="px-6 py-10 text-sm text-zinc-500">opening the door…</p>}
    </DoorContext.Provider>
  );
}

function CogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
