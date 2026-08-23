"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

export function craneFoldKey(slug: string, section: string): string {
  return `gantree.fold.v1.${slug}.${section}`;
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

  return (
    <section data-shot={shot} className={className}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${open ? "mb-3" : ""}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs text-zinc-500" aria-hidden>
              {open ? "▾" : "▸"}
            </span>
            <span className="text-sm font-medium text-zinc-400">{title}</span>
            {summary ? <span className="text-xs text-zinc-500">{summary}</span> : null}
          </span>
          {!open && hint ? <span className="mt-1 block pl-5 text-[11px] text-zinc-600">{hint}</span> : null}
        </button>
        {aside}
      </div>
      {open ? children : null}
    </section>
  );
}
