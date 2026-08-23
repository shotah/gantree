"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { OperatorRole } from "@/lib/yard/door/channels";
import { OperatorAvatar } from "./OperatorAvatar";
import { GantreeMark } from "./GantreeMark";
import { phoneFrameSrc } from "./phonePreview";

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
  const searchParams = useSearchParams();
  const phone = phoneFrameSrc(path, searchParams.toString());
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
    if (dest && !phone.on) {
      window.location.replace(dest);
    }
  }, [dest, phone.on]);

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/login");
  }

  const you = door?.operator;
  const label = you ? you.displayName || you.name : "";

  if (phone.on) {
    return (
      <div data-shot="phone-preview" className="flex min-h-screen flex-col items-center bg-zinc-950 px-3 py-3">
        <p className="mb-2 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-500">
          <span>390px phone</span>
          <Link href={phone.src} className="text-amber-200 hover:text-amber-100">
            exit
          </Link>
        </p>
        <iframe
          title="phone preview"
          src={phone.src}
          className="w-[390px] max-w-full rounded-[1.25rem] border border-zinc-700 bg-zinc-950 shadow-xl"
          style={{ height: "min(844px, calc(100dvh - 3.5rem))" }}
        />
      </div>
    );
  }

  return (
    <DoorContext.Provider value={door ?? { ready: false, operator: null }}>
      <header className="border-b border-zinc-800 px-6 py-3 max-sm:px-4 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 max-sm:gap-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-amber-500 max-sm:text-xl">
            <GantreeMark className="h-7 w-7 shrink-0 max-sm:h-8 max-sm:w-8" />
            gantree
          </Link>
          <div className="flex items-center gap-3 text-xs text-zinc-500 max-sm:gap-1 max-sm:text-sm">
            <p className="max-sm:hidden">shipping yard · not the chat</p>
            <Link
              href={`${path}?phone=1`}
              className="hidden text-zinc-400 hover:text-amber-200 sm:inline-flex"
              aria-label="phone preview"
              title="phone preview — 390px, no DevTools"
            >
              <PhoneIcon />
            </Link>
            {you ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 text-zinc-400 hover:text-amber-200 max-sm:min-h-11"
                >
                  <OperatorAvatar id={you.id} rev={you.avatarRev} name={label} />
                  <span className="max-sm:max-w-24 max-sm:truncate">
                    {label}
                    <span className="ml-1.5 text-zinc-600 max-sm:hidden">{you.role}</span>
                  </span>
                </Link>
                <Link
                  href="/settings"
                  className="text-zinc-400 hover:text-amber-200 max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center"
                  aria-label="settings"
                  title="settings"
                >
                  <CogIcon />
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-amber-200/80 hover:text-amber-200 max-sm:min-h-11 max-sm:px-2"
                >
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <circle cx="12" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 max-sm:h-6 max-sm:w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
