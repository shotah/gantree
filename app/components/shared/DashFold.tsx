"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

export function craneFoldKey(slug: string, section: string): string {
  return `gantree.fold.v1.${slug}.${section}`;
}

/** Shared across every crane so hopping agents keeps the same open set. */
export const CRANE_LAYOUT_ID = "crane";

export const CRANE_FOLD_SECTIONS = [
  "photo",
  "telegram",
  "metrics",
  "logs",
  "events",
  "doctor",
  "tools",
  "persona",
  "secrets",
  "pin",
] as const;

export function craneLayoutKey(section: string): string {
  return craneFoldKey(CRANE_LAYOUT_ID, section);
}

export function craneLayoutKeys(): string[] {
  return CRANE_FOLD_SECTIONS.map((s) => craneLayoutKey(s));
}

const foldListeners = new Set<() => void>();

function subscribeFold(onChange: () => void): () => void {
  foldListeners.add(onChange);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onChange);
  }
  return () => {
    foldListeners.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onChange);
    }
  };
}

function notifyFold(): void {
  for (const l of foldListeners) {
    l();
  }
}

function readFold(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "1") {
      return true;
    }
    if (raw === "0") {
      return false;
    }
  } catch {
    /* private mode */
  }
  return null;
}

function writeFold(key: string, open: boolean): void {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* private mode */
  }
  notifyFold();
}

export function setFolds(keys: readonly string[], open: boolean): void {
  try {
    const v = open ? "1" : "0";
    for (const key of keys) {
      localStorage.setItem(key, v);
    }
  } catch {
    /* private mode */
  }
  notifyFold();
}

export function FoldAllBar({ keys }: { keys: readonly string[] }) {
  return (
    <div role="group" aria-label="Sections" className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
      <button
        type="button"
        onClick={() => setFolds(keys, true)}
        className="hover:text-amber-500 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
      >
        open all
      </button>
      <button
        type="button"
        onClick={() => setFolds(keys, false)}
        className="hover:text-amber-500 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
      >
        close all
      </button>
    </div>
  );
}

export function DashFold({
  title,
  summary,
  hint,
  aside,
  children,
  className,
  shot,
  defaultOpen = false,
  persistKey,
  warn = false,
}: {
  title: string;
  summary?: ReactNode;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  shot?: string;
  defaultOpen?: boolean;
  persistKey?: string;
  warn?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const stored = useSyncExternalStore(
    subscribeFold,
    () => (persistKey ? readFold(persistKey) : null),
    () => null,
  );
  const open = persistKey ? (stored ?? defaultOpen) : localOpen;

  function toggle() {
    const next = !open;
    if (persistKey) {
      writeFold(persistKey, next);
    } else {
      setLocalOpen(next);
    }
  }

  const box = "min-w-0 max-w-full rounded-lg border border-zinc-800 bg-zinc-900/60 p-4";

  return (
    <section data-shot={shot} className={className ? `${box} ${className}` : box}>
      <div className={`flex min-w-0 flex-wrap items-start justify-between gap-3 ${open ? "mb-3" : ""}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="group min-w-0 flex-1 cursor-pointer py-0.5 text-left max-sm:py-1"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-500 group-hover:border-zinc-500 group-hover:text-zinc-400 max-sm:h-8 max-sm:w-8"
              aria-hidden
            >
              <svg
                viewBox="0 0 12 12"
                className={`block h-4 w-4 origin-center fill-current ${open ? "rotate-90" : ""} max-sm:h-5 max-sm:w-5`}
              >
                <path d="M3.4 2.6v6.8L8.6 6z" />
              </svg>
            </span>
            <span className="text-sm font-medium text-zinc-400 max-sm:text-base">{title}</span>
            {warn
              ? (
                  <span className="rounded border border-amber-900/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                    warn
                  </span>
                )
              : null}
            {summary ? <span className="text-xs text-zinc-500 max-sm:text-sm">{summary}</span> : null}
          </span>
          {!open && hint ? <span className="mt-1 block pl-9 text-[11px] text-zinc-600 max-sm:pl-10 max-sm:text-xs">{hint}</span> : null}
        </button>
        {aside}
      </div>
      {open ? children : null}
    </section>
  );
}
