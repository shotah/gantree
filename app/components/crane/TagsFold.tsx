"use client";

import { useState } from "react";
import { HINTS } from "@/lib/yard/hints";
import { parseTag, TAG_MAX, type TagColor } from "@/lib/yard/crane/tags";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import { HintField } from "../shared/HintField";
import { TagChips, TagSwatches } from "../shared/TagChips";
import type { AgentDash } from "./useAgentDashboard";

export function TagsFold({ dash }: { dash: AgentDash }) {
  const { gantry, tagColors, mutate, busy, saveTags } = dash;
  const tags = gantry?.tags ?? [];
  const [draft, setDraft] = useState("");
  const [hue, setHue] = useState<TagColor>("red");
  const [localError, setLocalError] = useState<string | null>(null);

  async function add(raw: string) {
    const t = parseTag(raw);
    if (!t) {
      setLocalError(HINTS.craneTags.hint);
      return;
    }
    if (tags.includes(t)) {
      setDraft("");
      setLocalError(null);
      await saveTags(tags, { [t]: hue });
      return;
    }
    if (tags.length >= TAG_MAX) {
      setLocalError(`at most ${TAG_MAX} tags`);
      return;
    }
    setLocalError(null);
    setDraft("");
    await saveTags([...tags, t], { [t]: hue });
  }

  return (
    <DashFold
      title="Tags"
      persistKey={craneLayoutKey("tags")}
      hint="whose keys, which house"
      summary={tags.length ? tags.join(" · ") : "none"}
    >
      <p className="mb-2 text-xs text-faint">
        Color is yard-wide — the same label stays the same hue on every card. Pick a hue, then Add. Click a chip to repaint it.
      </p>
      <TagChips
        tags={tags}
        colors={tagColors}
        onPaint={mutate && !busy ? (t) => void saveTags(tags, { [t]: hue }) : undefined}
        onRemove={mutate && !busy ? (t) => void saveTags(tags.filter((x) => x !== t)) : undefined}
      />
      {mutate
        ? (
            <form
              className="mt-3 flex min-w-0 flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add(draft);
              }}
            >
              <HintField label="add tag" className="min-w-40 flex-1 max-sm:min-w-0 max-sm:w-full" {...HINTS.craneTags}>
                <input
                  className="w-full rounded border border-line bg-canvas px-2 py-1 text-xs max-sm:text-sm"
                  value={draft}
                  disabled={busy}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="home"
                />
              </HintField>
              <TagSwatches value={hue} onChange={setHue} disabled={busy} />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="rounded border border-edge px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )
        : (
            <p className="mt-2 text-xs text-faint">read only</p>
          )}
      {localError ? <p className="mt-2 text-xs text-mark">{localError}</p> : null}
    </DashFold>
  );
}
