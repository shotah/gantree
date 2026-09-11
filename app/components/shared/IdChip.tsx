"use client";

import { useState } from "react";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function IdChip({
  id,
  extra,
  onRemove,
  removeDisabled = false,
}: {
  id: string;
  extra?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(id);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-edge px-2 py-0.5 text-xs text-fg">
      <code className="max-w-full select-all break-all font-mono">{id}</code>
      {extra
        ? (
            <span className="shrink-0 text-dim">{extra}</span>
          )
        : null}
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 text-[10px] uppercase tracking-wide text-accent hover:text-accent-hover"
        aria-label={`copy ${id}`}
      >
        {copied ? "copied" : "copy"}
      </button>
      {onRemove
        ? (
            <button
              type="button"
              disabled={removeDisabled}
              onClick={onRemove}
              className="shrink-0 text-dim hover:text-danger disabled:opacity-50"
              aria-label={`remove ${id}`}
              title="remove"
            >
              ×
            </button>
          )
        : null}
    </span>
  );
}
