"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { OperatorRole } from "@/lib/yard/door/channels";
import { OperatorAvatar } from "./OperatorAvatar";
import { GantreeMark } from "./GantreeMark";
import { ThemeSelect } from "./ThemeSelect";
import { PHONE_PRESETS, phoneFrameSrc, phonePreset, phonePreviewHref } from "@/app/lib/phonePreview";

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
  /** Present when `/api/door` says GANTREE_DEV auto-login is on. */
  dev?: boolean;
};

const DoorContext = createContext<DoorState>({ ready: false, operator: null, dev: false });

export function useDoor(): DoorState {
  return useContext(DoorContext);
}

export function DoorShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const [door, setDoor] = useState<DoorState | null>(null);
  const phone = phoneFrameSrc(path, searchParams.toString(), Boolean(door?.dev));

  useEffect(() => {
    let live = true;
    function load() {
      fetch("/api/door", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d: DoorState) => {
          if (live) {
            setDoor({ ready: d.ready, operator: d.operator, dev: Boolean(d.dev) });
          }
        })
        .catch(() => {
          if (live) {
            setDoor({ ready: false, operator: null, dev: false });
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
    const size = phone.preset;
    return (
      <div data-shot="phone-preview" className="flex min-h-screen min-w-0 flex-col items-center overflow-x-clip bg-canvas px-3 py-3">
        <p className="mb-2 flex flex-wrap items-center justify-center gap-3 text-sm text-dim">
          <ThemeSelect />
          <label className="flex items-center gap-2">
            <span className="sr-only">phone size</span>
            <select
              aria-label="phone size"
              className="rounded border border-line bg-canvas px-1.5 py-0.5 text-sm text-body"
              value={size.id}
              onChange={(e) => {
                window.location.replace(phonePreviewHref(path, searchParams.toString(), phonePreset(e.target.value).id));
              }}
            >
              {PHONE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <span>
            {size.width}×{size.height}
          </span>
          <Link href={phone.src} className="text-mark hover:text-accent-hover">
            exit
          </Link>
        </p>
        <iframe
          title="phone preview"
          src={phone.src}
          className="min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border border-edge bg-canvas shadow-xl"
          style={{
            width: size.width,
            maxWidth: "100%",
            height: `min(${size.height}px, calc(100dvh - 3.5rem))`,
          }}
        />
      </div>
    );
  }

  return (
    <DoorContext.Provider value={door ?? { ready: false, operator: null, dev: false }}>
      <header className="min-w-0 border-b border-line px-6 py-3 max-sm:px-4 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-4 max-sm:gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-accent max-sm:text-xl">
            <GantreeMark className="h-7 w-7 shrink-0 max-sm:h-8 max-sm:w-8" />
            gantree
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-3 text-xs text-dim max-sm:gap-1 max-sm:text-sm">
            <ThemeSelect />
            <p className="max-sm:hidden">shipping yard · not the chat</p>
            {door?.dev
              ? (
                  <Link
                    href={`${path}?phone=1`}
                    className="hidden text-muted hover:text-mark sm:inline-flex"
                    aria-label="phone preview"
                    title="phone preview — device frame, no DevTools"
                  >
                    <PhoneIcon />
                  </Link>
                )
              : null}
            {you
              ? (
                  <>
                    <Link
                      href="/profile"
                      aria-label={label}
                      className="flex min-w-0 items-center gap-2 text-muted hover:text-mark max-sm:min-h-11"
                    >
                      <OperatorAvatar id={you.id} rev={you.avatarRev} name={label} />
                      <span className="hidden min-w-0 truncate sm:inline">
                        {label}
                        <span className="ml-1.5 text-faint">{you.role}</span>
                      </span>
                    </Link>
                    <Link
                      href="/settings"
                      className="text-muted hover:text-mark max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center"
                      aria-label="settings"
                      title="settings"
                    >
                      <CogIcon />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="text-mark/80 hover:text-mark max-sm:min-h-11 max-sm:px-2"
                    >
                      log out
                    </button>
                  </>
                )
              : null}
          </div>
        </div>
      </header>
      {allow ? children : <p className="px-6 py-10 text-sm text-dim">opening the door…</p>}
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
