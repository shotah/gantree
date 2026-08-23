"use client";

import { useState } from "react";
import { HINTS } from "@/lib/yard/hints";
import { GantreeMark } from "../shared/GantreeMark";
import { HintField } from "../shared/HintField";

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
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 max-sm:gap-5" data-shot={setup ? "setup" : "login"}>
      <div className="flex items-start gap-3">
        <GantreeMark tiled className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] ring-1 ring-zinc-800 max-sm:h-14 max-sm:w-14" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100 max-sm:text-3xl">{setup ? "First operator" : "Log in"}</h1>
          <p className="mt-1 text-sm text-zinc-500 max-sm:text-base">
            {setup
              ? "This yard has no door yet. Create the operator who owns the box. Passphrase ≥10 characters — not blank, not your name, not a common password. Forgot later: sqlite3 gantree.db, delete from operator."
              : "Same yard. Same files. Chat still stays Telegram."}
          </p>
        </div>
      </div>
      <HintField label="name" {...HINTS.operatorName}>
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={32}
          pattern="[a-zA-Z0-9._-]{2,32}"
        />
      </HintField>
      <HintField label="passphrase" {...HINTS.operatorPass}>
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          type="password"
          autoComplete={setup ? "new-password" : "current-password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
          minLength={10}
          maxLength={128}
        />
      </HintField>
      {setup
        ? (
            <HintField label="confirm" {...HINTS.operatorConfirm}>
              <input
                className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={10}
                maxLength={128}
              />
            </HintField>
          )
        : null}
      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50 max-sm:min-h-12 max-sm:text-base"
      >
        {busy ? "…" : setup ? "Create operator" : "Log in"}
      </button>
    </form>
  );
}
