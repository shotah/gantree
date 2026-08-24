"use client";

import { useEffect, useState } from "react";
import { yardFetch } from "@/app/lib/yardFetch";
import { HINTS } from "@/lib/yard/hints";
import type { ObservePrefs } from "@/lib/yard/types";
import { HintField } from "../shared/HintField";

export function YardPane({ admin }: { admin: boolean }) {
  const [prefs, setPrefs] = useState<ObservePrefs | null>(null);
  const [hostDays, setHostDays] = useState(7);
  const [turnDays, setTurnDays] = useState(32);
  const [timezone, setTimezone] = useState("");
  const [image, setImage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [gen, setGen] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    yardFetch("/api/observe")
      .then((r) => r.json())
      .then((d: { observe?: ObservePrefs; error?: string }) => {
        if (d.error || !d.observe) {
          setErr(d.error || "could not load observe prefs");
          return;
        }
        setPrefs(d.observe);
        setHostDays(d.observe.hostRetainDays);
        setTurnDays(d.observe.turnRetainDays);
        setTimezone(d.observe.timezone ?? "");
        setImage(d.observe.defaultImage);
        setPrompt(d.observe.promptUsdPerMillion != null ? String(d.observe.promptUsdPerMillion) : "");
        setGen(d.observe.genUsdPerMillion != null ? String(d.observe.genUsdPerMillion) : "");
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const shrink = Boolean(prefs && (hostDays < prefs.hostRetainDays || turnDays < prefs.turnRetainDays));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await yardFetch("/api/observe", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        hostRetainDays: hostDays,
        turnRetainDays: turnDays,
        timezone: timezone.trim() || null,
        defaultImage: image.trim(),
        promptUsdPerMillion: prompt.trim() === "" ? null : Number(prompt),
        genUsdPerMillion: gen.trim() === "" ? null : Number(gen),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; observe?: ObservePrefs };
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || res.statusText);
      return;
    }
    if (data.observe) {
      setPrefs(data.observe);
    }
    setConfirm(false);
    setNotice("yard prefs saved to gantree.toml");
  }

  if (!prefs) {
    return <p className="text-sm text-dim">{err || "loading yard prefs…"}</p>;
  }

  return (
    <form className="flex max-w-lg flex-col gap-3 rounded-lg border border-line bg-panel/60 p-4" onSubmit={save}>
      {err ? <p className="text-sm text-mark">{err}</p> : null}
      {notice ? <p className="text-sm text-body">{notice}</p> : null}
      <HintField label="host retain days" {...HINTS.hostRetain}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          type="number"
          min={1}
          max={90}
          value={hostDays}
          disabled={!admin}
          onChange={(e) => setHostDays(Number(e.target.value))}
        />
      </HintField>
      <HintField label="turn retain days" {...HINTS.turnRetain}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          type="number"
          min={1}
          max={120}
          value={turnDays}
          disabled={!admin}
          onChange={(e) => setTurnDays(Number(e.target.value))}
        />
      </HintField>
      <HintField label="timezone" {...HINTS.timezone}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={timezone}
          disabled={!admin}
          placeholder="America/Los_Angeles — blank = local"
          onChange={(e) => setTimezone(e.target.value)}
        />
      </HintField>
      <HintField label="default image pin" {...HINTS.defaultImage}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={image}
          disabled={!admin}
          onChange={(e) => setImage(e.target.value)}
        />
        <span className="text-xs text-dim">New cranes only. Existing compose tags stay until you pin/recreate.</span>
      </HintField>
      <HintField label="prompt $/1M" {...HINTS.promptRate}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={prompt}
          disabled={!admin}
          inputMode="decimal"
          placeholder="calculator only — not a bill"
          onChange={(e) => setPrompt(e.target.value)}
        />
      </HintField>
      <HintField label="gen $/1M" {...HINTS.genRate}>
        <input
          className="rounded border border-line bg-canvas px-3 py-2 text-sm text-fg"
          value={gen}
          disabled={!admin}
          inputMode="decimal"
          placeholder="optional"
          onChange={(e) => setGen(e.target.value)}
        />
      </HintField>
      <p className="text-[11px] text-faint">
        Session idle (7 days) and absolute (30 days) stay in the door code — not toml. See docs/security.md.
      </p>
      {admin
        ? (
            <>
              <label className="flex items-center gap-2 text-xs text-mark">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                {shrink ? "I am shortening retain — older sqlite samples will be deleted" : "I am saving yard observe prefs"}
              </label>
              <button
                type="submit"
                disabled={busy || !confirm}
                className="rounded border border-accent-line bg-accent-soft px-3 py-2 text-sm text-mark hover:border-accent disabled:opacity-50"
              >
                Save yard prefs
              </button>
            </>
          )
        : (
            <p className="text-xs text-dim">Rates are visible so spend $ matches. Only admin can write.</p>
          )}
    </form>
  );
}
