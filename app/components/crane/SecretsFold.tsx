"use client";

import { envHint } from "@/lib/yard/hints";
import { secretLook, secretNoun } from "@/lib/yard/secretLook";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import { HintField } from "../shared/HintField";
import { envRow, fieldValue, looksLikeUrl } from "./agentEnv";
import type { AgentDash } from "./useAgentDashboard";

export function SecretsFold({ dash }: { dash: AgentDash }) {
  const {
    files,
    secretKeys,
    optionalSecretKeys,
    missingSecrets,
    secretDraft,
    setSecretDraft,
    confirmToken,
    setConfirmToken,
    busy,
    saveEnv,
  } = dash;

  return (
    <DashFold
      title="Secrets"
      persistKey={craneLayoutKey("secrets")}
      hint="crane mouth plus keys for granted tools"
      summary={
        missingSecrets === 1
          ? (
              <span className="text-mark">needs a key</span>
            )
          : missingSecrets
            ? (
                <span className="text-mark">
                  {missingSecrets}
                  {" "}
                  need a key
                </span>
              )
            : undefined
      }
    >
      <p className="mb-2 text-xs text-faint">
        Only the crane mouth plus keys for
        {" "}
        <em>granted</em>
        {" "}
        tools (from that
        package's host-manifest). Toggle a server first. Never paste a whole
        fleet .env. Keys and tokens stay hidden after save. Recreate after env
        change.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {secretKeys.map((k) => {
          const row = envRow(k, files?.env);
          const shown = fieldValue(k, row, secretDraft);
          const optional = optionalSecretKeys.has(k);
          const look = secretLook(row, shown, secretNoun(k));
          const shownLook
            = optional && look.missing
              ? { ...look, placeholder: "optional", status: "optional", missing: false }
              : look;
          const badUrl = k === "LLM_BASE_URL" && shown.trim() !== "" && !looksLikeUrl(shown);
          const warn = shownLook.missing || badUrl;
          const tip = envHint(k);
          return (
            <HintField
              key={k}
              label={k}
              hint={tip.hint}
              example={tip.example}
              aside={(
                <span className={`text-[11px] ${warn ? "text-warn" : "text-faint"}`}>
                  {badUrl ? "not a URL" : shownLook.status}
                </span>
              )}
            >
              <input
                className={`rounded border bg-canvas px-2 py-1 ${
                  warn ? "border-warn-line placeholder:text-warn/90" : "border-line"
                }`}
                type={shownLook.type}
                name={`gantree-env-${k}`}
                autoComplete={row.secret ? "new-password" : "off"}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={shownLook.placeholder}
                value={shown}
                disabled={!files?.writable}
                onChange={(e) => setSecretDraft((s) => ({ ...s, [k]: e.target.value }))}
              />
            </HintField>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-mark">
        <input type="checkbox" checked={confirmToken} onChange={(e) => setConfirmToken(e.target.checked)} disabled={!files?.writable} />
        I am overwriting secrets / bot tokens
      </label>
      <button
        type="button"
        disabled={busy || !files?.writable}
        onClick={() => void saveEnv()}
        className="mt-2 rounded border border-edge px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50"
      >
        Save .env
      </button>
    </DashFold>
  );
}
