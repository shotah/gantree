"use client";

import { useCallback, useEffect, useState } from "react";
import { yardFetch } from "../lib/yardFetch";

type OperatorRow = { id: string; name: string; createdAt: string };

export function Operators() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [you, setYou] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [addConfirm, setAddConfirm] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [nextConfirm, setNextConfirm] = useState("");
  const [passConfirm, setPassConfirm] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: OperatorRow[]; you?: { id: string; name: string }; error?: string }) => {
        if (d.error) {
          setErr(d.error);
          return;
        }
        setOperators(d.operators ?? []);
        setYou(d.you ?? null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await yardFetch("/api/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || res.statusText);
      return false;
    }
    return true;
  }

  const last = operators.length <= 1;

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100">Operators</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A handful of people who own the box. Equal access. Hashes never leave the yard sqlite.
        </p>
      </div>

      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      {notice ? <p className="text-sm text-zinc-300">{notice}</p> : null}

      <ul className="space-y-2">
        {operators.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-stone-100">{o.name}</span>
              {you?.id === o.id ? <span className="ml-2 text-xs text-zinc-500">you</span> : null}
            </span>
            {removeId === o.id ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-2 text-amber-200">
                  <input type="checkbox" checked={removeConfirm} onChange={(e) => setRemoveConfirm(e.target.checked)} />
                  I am removing this operator. Their sessions die.
                </label>
                <button
                  type="button"
                  disabled={busy || !removeConfirm || last}
                  onClick={async () => {
                    if (await post({ op: "remove", id: o.id, confirm: true })) {
                      setNotice(`${o.name} removed`);
                      setRemoveId(null);
                      setRemoveConfirm(false);
                      load();
                    }
                  }}
                  className="rounded border border-red-900/80 px-2 py-1 text-red-300 disabled:opacity-50"
                >
                  confirm remove
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemoveId(null);
                    setRemoveConfirm(false);
                  }}
                  className="text-zinc-500"
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || last}
                onClick={() => {
                  setRemoveId(o.id);
                  setRemoveConfirm(false);
                }}
                className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
                title={last ? "cannot delete the last operator" : "remove"}
              >
                remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="flex max-w-md flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (passphrase !== confirmPass) {
            setErr("passphrases do not match");
            return;
          }
          if (await post({ op: "add", name, passphrase, confirm: addConfirm })) {
            setNotice(`added ${name}`);
            setName("");
            setPassphrase("");
            setConfirmPass("");
            setAddConfirm(false);
            load();
          }
        }}
      >
        <h2 className="text-sm font-medium text-zinc-400">Add a partner</h2>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          name
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          passphrase
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          confirm
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-amber-200">
          <input type="checkbox" checked={addConfirm} onChange={(e) => setAddConfirm(e.target.checked)} />
          I am adding a partner who can mutate this yard
        </label>
        <button
          type="submit"
          disabled={busy || !addConfirm}
          className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50"
        >
          Add operator
        </button>
      </form>

      <form
        className="flex max-w-md flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (next !== nextConfirm) {
            setErr("new passphrases do not match");
            return;
          }
          if (await post({ op: "passphrase", current, next, confirm: passConfirm })) {
            setNotice("passphrase updated");
            setCurrent("");
            setNext("");
            setNextConfirm("");
            setPassConfirm(false);
          }
        }}
      >
        <h2 className="text-sm font-medium text-zinc-400">Change your passphrase</h2>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          current
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          new
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          confirm new
          <input
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
            type="password"
            value={nextConfirm}
            onChange={(e) => setNextConfirm(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-amber-200">
          <input type="checkbox" checked={passConfirm} onChange={(e) => setPassConfirm(e.target.checked)} />
          I am changing my passphrase
        </label>
        <button
          type="submit"
          disabled={busy || !passConfirm}
          className="rounded border border-zinc-700 px-3 py-2 text-sm hover:border-amber-700 disabled:opacity-50"
        >
          Update passphrase
        </button>
      </form>
    </section>
  );
}
