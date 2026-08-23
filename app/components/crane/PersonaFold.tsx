"use client";

import { HINTS } from "@/lib/yard/hints";
import { craneFoldKey, DashFold } from "../shared/DashFold";
import { HintField } from "../shared/HintField";
import type { AgentDash } from "./useAgentDashboard";

export function PersonaFold({ dash }: { dash: AgentDash }) {
  const {
    slug,
    files,
    persona,
    setPersona,
    self,
    setSelf,
    personaFromTemplate,
    selfFromTemplate,
    confirmPersonaReplace,
    setConfirmPersonaReplace,
    confirmSelfReplace,
    setConfirmSelfReplace,
    setInjectOpen,
    busy,
    admin,
    loadTemplate,
    saveMarkdown,
  } = dash;

  return (
    <DashFold title="Persona" persistKey={craneFoldKey(slug, "persona")} hint="PERSONA.md and SELF.md">
      <HintField label="PERSONA.md" {...HINTS.persona}>
        <textarea
          className="min-h-40 w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-sm"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          disabled={!files?.writable}
          placeholder="PERSONA.md — set persona_dir in gantree.toml to edit"
        />
      </HintField>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={() => loadTemplate("persona")}
          aria-label="Replace PERSONA.md from template"
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Replace from template
        </button>
        {admin && files?.writable
          ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setInjectOpen(true)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
              >
                Inject user
              </button>
            )
          : null}
        <button
          type="button"
          disabled={busy || !files?.writable || (personaFromTemplate && !confirmPersonaReplace)}
          onClick={() => saveMarkdown("persona")}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Save PERSONA.md
        </button>
      </div>
      {personaFromTemplate
        ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-amber-200">
              <input
                type="checkbox"
                checked={confirmPersonaReplace}
                onChange={(e) => setConfirmPersonaReplace(e.target.checked)}
                disabled={!files?.writable}
              />
              I know this will overwrite PERSONA.md when I save
            </label>
          )
        : null}
      <HintField label="SELF.md" className="mt-5" {...HINTS.self}>
        <textarea
          className="min-h-40 w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-sm"
          value={self}
          onChange={(e) => setSelf(e.target.value)}
          disabled={!files?.writable}
          placeholder="SELF.md — prune harness memory; recreate to reload"
        />
      </HintField>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !files?.writable}
          onClick={() => loadTemplate("self")}
          aria-label="Replace SELF.md from template"
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Replace from template
        </button>
        <button
          type="button"
          disabled={busy || !files?.writable || (selfFromTemplate && !confirmSelfReplace)}
          onClick={() => saveMarkdown("self")}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-amber-700 disabled:opacity-50"
        >
          Save SELF.md
        </button>
      </div>
      {selfFromTemplate
        ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-amber-200">
              <input
                type="checkbox"
                checked={confirmSelfReplace}
                onChange={(e) => setConfirmSelfReplace(e.target.checked)}
                disabled={!files?.writable}
              />
              I know this will overwrite SELF.md when I save
            </label>
          )
        : null}
    </DashFold>
  );
}
