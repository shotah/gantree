"use client";

import { useState } from "react";
import { HINTS } from "@/lib/yard/hints";
import { suggestCloneSlug } from "@/lib/yard/crane/slug";
import { HintField } from "../shared/HintField";
import { YardModal } from "../shared/YardModal";

export type CloneChoice = {
  slug: string;
  settings: boolean;
  persona: boolean;
  database: boolean;
};

export function CloneModal({
  sourceSlug,
  busy,
  onClose,
  onClone,
}: {
  sourceSlug: string;
  busy: boolean;
  onClose: () => void;
  onClone: (choice: CloneChoice) => Promise<string | null>;
}) {
  const [dest, setDest] = useState(() => suggestCloneSlug(sourceSlug));
  const [settings, setSettings] = useState(true);
  const [persona, setPersona] = useState(false);
  const [database, setDatabase] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const any = settings || persona || database;

  async function submit() {
    if (!any || busy) {
      return;
    }
    setErr(null);
    const detail = await onClone({ slug: dest, settings, persona, database });
    if (detail) {
      setErr(detail);
    }
  }

  return (
    <YardModal
      title={`Clone ${sourceSlug}`}
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-edge px-3 py-1.5 text-xs hover:border-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !any || !dest.trim()}
            onClick={() => void submit()}
            className="rounded border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-mark hover:border-accent disabled:opacity-50"
          >
            {busy ? "cloning…" : "Clone"}
          </button>
        </>
      )}
    >
      <p>{HINTS.cloneCrane.hint}</p>
      <HintField label="slug" className="mt-3" {...HINTS.cloneSlug}>
        <input
          required
          className="rounded border border-edge bg-canvas px-2 py-1"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="kit-copy"
        />
      </HintField>
      <label className="mt-3 flex items-start gap-2 text-sm text-body">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings}
          onChange={(e) => setSettings(e.target.checked)}
        />
        <span>
          settings
          <span className="mt-0.5 block text-xs text-dim">{HINTS.cloneSettings.hint}</span>
        </span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm text-body">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={persona}
          onChange={(e) => setPersona(e.target.checked)}
        />
        <span>
          persona files
          <span className="mt-0.5 block text-xs text-dim">{HINTS.clonePersona.hint}</span>
        </span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm text-body">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={database}
          onChange={(e) => setDatabase(e.target.checked)}
        />
        <span>
          database
          <span className="mt-0.5 block text-xs text-dim">{HINTS.cloneDatabase.hint}</span>
        </span>
      </label>
      {err ? <p className="mt-3 text-xs text-danger">{err}</p> : null}
    </YardModal>
  );
}
