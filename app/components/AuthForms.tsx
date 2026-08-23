"use client";

import { useState } from "react";

export function SetupForm() {
  return <AuthForm kind="setup" />;
}

export function LoginForm() {
  return <AuthForm kind="login" />;
}

function AuthForm({ kind }: { kind: "setup" | "login" }) {
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = kind === "setup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (setup && passphrase !== confirm) {
      setErr("passphrases do not match");
      return;
    }
    setBusy(true);
    const res = await fetch(setup ? "/api/setup" : "/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; setup?: boolean };
    setBusy(false);
    if (res.ok) {
      window.location.replace("/");
      return;
    }
    if (data.setup && !setup) {
      window.location.replace("/setup");
      return;
    }
    setErr(data.error || "could not sign in");
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100">{setup ? "First operator" : "Log in"}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {setup
            ? "This yard has no door yet. Create the operator who owns the box. Forgot later: sqlite3 gantree.db, delete from operator."
            : "Same yard. Same files. Chat still stays Telegram."}
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        name
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        passphrase
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          type="password"
          autoComplete={setup ? "new-password" : "current-password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
          minLength={10}
        />
      </label>
      {setup ? (
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          confirm
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={10}
          />
        </label>
      ) : null}
      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50"
      >
        {busy ? "…" : setup ? "Create operator" : "Log in"}
      </button>
    </form>
  );
}
