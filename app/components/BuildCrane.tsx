"use client";

import { useState } from "react";

export function BuildCrane({ onBuilt }: { onBuilt: () => void }) {
  const [open, setOpen] = useState(false);
  const [yard, setYard] = useState<"home" | "cloud">("home");
  const [slug, setSlug] = useState("");
  const [profile, setProfile] = useState<"slim" | "life" | "life-cast">("slim");
  const [model, setModel] = useState("gemini-3.5-flash");
  const [channel, setChannel] = useState("telegram");
  const [token, setToken] = useState("");
  const [allow, setAllow] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const env: Record<string, string> = {};
    if (channel === "telegram") {
      env.TELEGRAM_BOT_TOKEN = token;
      env.TELEGRAM_ALLOWED_USERS = allow;
    }
    const res = await fetch("/api/gantries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, yard, profile, model, channel, env }),
    });
    const data = (await res.json()) as { ok?: boolean; detail?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(data.detail || "could not build crane");
      return;
    }
    setOpen(false);
    setSlug("");
    setToken("");
    setAllow("");
    onBuilt();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600"
      >
        Build a crane
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-stone-100">New crane</h2>
        <button type="button" className="text-xs text-zinc-500" onClick={() => setOpen(false)}>
          cancel
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Yard first</span>
          <select className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" value={yard} onChange={(e) => setYard(e.target.value as "home" | "cloud")}>
            <option value="home">home Mini</option>
            <option value="cloud">cloud VM</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">slug</span>
          <input required className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="kit" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">profile</span>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            value={profile}
            onChange={(e) => setProfile(e.target.value as "slim" | "life" | "life-cast")}
          >
            <option value="slim">slim (search + math)</option>
            <option value="life">life</option>
            <option value="life-cast" disabled={yard === "cloud"}>
              life-cast (home only)
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">model</span>
          <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">channel</span>
          <select className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="telegram">telegram</option>
            <option value="discord">discord</option>
            <option value="slack">slack</option>
            <option value="stdio">stdio (dev)</option>
          </select>
        </label>
        {channel === "telegram" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">bot token</span>
              <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-zinc-500">allowlist (numeric ids)</span>
              <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1" value={allow} onChange={(e) => setAllow(e.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      {err ? <p className="mt-3 text-xs text-red-300">{err}</p> : null}
      <button disabled={busy} type="submit" className="mt-4 rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-50">
        {busy ? "building…" : "Build crane"}
      </button>
    </form>
  );
}
