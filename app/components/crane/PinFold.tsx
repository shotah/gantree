"use client";

import { HINTS } from "@/lib/yard/hints";
import { craneLayoutKey, DashFold } from "../shared/DashFold";
import { HintField } from "../shared/HintField";
import type { AgentDash } from "./useAgentDashboard";

export function PinFold({ dash }: { dash: AgentDash }) {
  const { pin, setPin, mutate, busy, act } = dash;

  return (
    <DashFold title="Image pin" persistKey={craneLayoutKey("pin")} hint="pull + recreate tag">
      <p className="mb-2 text-xs text-faint">
        pull + recreate uses this tag, keeps the host uid that owns
        {" "}
        <code className="text-dim">data/</code>
        , and
        waits for doctor. Recreate without pull does the same uid keep — it does not docker pull.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <HintField label="image" className="min-w-64 flex-1 max-sm:min-w-0 max-sm:w-full" {...HINTS.imagePin}>
          <input
            className="w-full rounded border border-line bg-canvas px-2 py-1 text-xs max-sm:text-sm"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={!mutate}
          />
        </HintField>
        <button
          type="button"
          disabled={busy || !mutate}
          onClick={() => act("pin")}
          className="rounded border border-edge px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50"
        >
          pull + recreate
        </button>
      </div>
    </DashFold>
  );
}
