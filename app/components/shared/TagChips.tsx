"use client";

import { parseTagColor, TAG_COLORS } from "@/lib/yard/crane/tags";
import type { TagColor } from "@/lib/yard/crane/tags";

/** Hue chips: ink for text and border, a wash of the same hue for fill — so the chip matches the swatch. */
const CHIP: Record<TagColor, string> = {
  red: "border-tag-red bg-tag-red/20 text-tag-red",
  green: "border-tag-green bg-tag-green/20 text-tag-green",
  amber: "border-tag-amber bg-tag-amber/20 text-tag-amber",
  sky: "border-tag-sky bg-tag-sky/20 text-tag-sky",
  violet: "border-tag-violet bg-tag-violet/20 text-tag-violet",
  rose: "border-tag-rose bg-tag-rose/20 text-tag-rose",
};

const DOT: Record<TagColor, string> = {
  red: "bg-tag-red",
  green: "bg-tag-green",
  amber: "bg-tag-amber",
  sky: "bg-tag-sky",
  violet: "bg-tag-violet",
  rose: "bg-tag-rose",
};

const FALLBACK = "border-edge bg-track/80 text-body";

export function tagChipClass(color: string | undefined): string {
  const c = parseTagColor(color);
  return c ? CHIP[c] : FALLBACK;
}

export function TagSwatches({
  value,
  onChange,
  disabled,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tag color">
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          aria-pressed={value === c}
          disabled={disabled}
          onClick={() => onChange(c)}
          className={`h-4 w-4 rounded-full ${DOT[c]} disabled:opacity-50 ${
            value === c ? "ring-2 ring-fg ring-offset-1 ring-offset-canvas" : "opacity-70 hover:opacity-100"
          }`}
        />
      ))}
    </div>
  );
}

export function TagChips({
  tags,
  colors = {},
  onRemove,
  onPaint,
  className = "",
}: {
  tags: string[];
  colors?: Record<string, string>;
  onRemove?: (tag: string) => void;
  /** Apply the currently picked hue to this label (yard-wide). */
  onPaint?: (tag: string) => void;
  className?: string;
}) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <ul className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {tags.map((t) => {
        const chip = `inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tagChipClass(colors[t])}`;
        return (
          <li key={t}>
            {onRemove || onPaint
              ? (
                  <span className={chip}>
                    {onPaint
                      ? (
                          <button type="button" onClick={() => onPaint(t)} className="hover:underline">
                            {t}
                          </button>
                        )
                      : t}
                    {onRemove
                      ? (
                          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onRemove(t)} className="text-dim hover:text-fg">
                            ×
                          </button>
                        )
                      : null}
                  </span>
                )
              : (
                  <span className={chip}>{t}</span>
                )}
          </li>
        );
      })}
    </ul>
  );
}
