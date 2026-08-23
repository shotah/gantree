"use client";

import { useCallback, useEffect, useState } from "react";
import { OPERATOR_ROLES, ROLE_BLURB, roleNeedsCrane } from "@/lib/yard/door/access";
import type { OperatorRole } from "@/lib/yard/door/channels";
import type { ObservePrefs } from "@/lib/yard/types";
import { yardFetch } from "../lib/yardFetch";
import { OperatorAvatar } from "./OperatorAvatar";

type OperatorRow = {
  id: string;
  name: string;
  displayName: string;
  role: OperatorRole;
  cranes: string[];
  avatarRev: number | null;
  createdAt: string;
};

export function YardSettings() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [you, setYou] = useState<OperatorRow | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [addRole, setAddRole] = useState<OperatorRole>("user");
  const [addCranes, setAddCranes] = useState<string[]>([]);
  const [addConfirm, setAddConfirm] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<OperatorRole>("user");
  const [editCranes, setEditCranes] = useState<string[]>([]);
  const [editConfirm, setEditConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState<"people" | "yard">("people");

  const admin = you?.role === "admin";

  const load = useCallback(() => {
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: OperatorRow[]; you?: OperatorRow; error?: string }) => {
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

  useEffect(() => {
    if (!admin) {
      return;
    }
    yardFetch("/api/gantries")
      .then((r) => r.json())
      .then((d: { gantries?: { slug: string }[] }) => {
        setSlugs((d.gantries ?? []).map((g) => g.slug));
      })
      .catch(() => undefined);
  }, [admin]);

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
    <section className="flex flex-col gap-8" data-shot="settings">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {pane === "yard"
            ? "Retain, timezone, default pin, optional $/1M. Session idle stays in the door — not this table."
            : admin
              ? "Who is on this yard, and what they can touch. Your photo and passphrase are on Profile."
              : "Your role is assigned by an admin. Photo and passphrase are on Profile."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 pb-px">
        <button
          type="button"
          className={`rounded-t px-3 py-1.5 text-sm ${pane === "people" ? "border border-b-transparent border-zinc-700 bg-zinc-950 text-stone-100" : "text-zinc-500 hover:text-zinc-300"}`}
          onClick={() => setPane("people")}
        >
          People
        </button>
        <button
          type="button"
          className={`rounded-t px-3 py-1.5 text-sm ${pane === "yard" ? "border border-b-transparent border-zinc-700 bg-zinc-950 text-stone-100" : "text-zinc-500 hover:text-zinc-300"}`}
          onClick={() => setPane("yard")}
        >
          Yard
        </button>
      </div>

      {pane === "yard" ? <YardPane admin={admin} /> : null}

      {pane === "people" ? (
      <>
      <ul className="grid gap-3 text-sm sm:grid-cols-3">
        {OPERATOR_ROLES.map((role) => (
          <li key={role} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <p className="font-medium text-stone-100">{role}</p>
            <p className="mt-1 text-xs text-zinc-500">{ROLE_BLURB[role]}</p>
          </li>
        ))}
      </ul>

      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      {notice ? <p className="text-sm text-zinc-300">{notice}</p> : null}

      <ul className="space-y-2">
        {operators.map((o) => (
          <li key={o.id} className="rounded border border-zinc-800 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <OperatorAvatar id={o.id} rev={o.avatarRev} name={o.displayName || o.name} />
                <span>
                  <span className="font-medium text-stone-100">{o.displayName || o.name}</span>
                  {you?.id === o.id ? <span className="ml-2 text-xs text-zinc-500">you</span> : null}
                  <span className="ml-2 text-xs text-zinc-500">{o.role}</span>
                  {o.cranes?.length ? <span className="ml-1 text-xs text-amber-200/80">{o.cranes.join(", ")}</span> : null}
                  {o.name !== o.displayName ? <span className="ml-2 text-xs text-zinc-600">{o.name}</span> : null}
                </span>
              </div>
              {admin ? (
                <div className="flex flex-wrap items-center gap-2">
                  {editId === o.id ? null : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditId(o.id);
                        setEditRole(o.role);
                        setEditCranes(o.cranes ?? []);
                        setEditConfirm(false);
                        setRemoveId(null);
                      }}
                      className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
                    >
                      role
                    </button>
                  )}
                  {removeId === o.id ? null : (
                    <button
                      type="button"
                      disabled={busy || last}
                      onClick={() => {
                        setRemoveId(o.id);
                        setRemoveConfirm(false);
                        setEditId(null);
                      }}
                      className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-700 disabled:opacity-50"
                      title={last ? "cannot delete the last operator" : "remove"}
                    >
                      remove
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            {admin && editId === o.id ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await post({
                      op: "access",
                      id: o.id,
                      role: editRole,
                      cranes: roleNeedsCrane(editRole) ? editCranes : [],
                      confirm: editConfirm,
                    })
                  ) {
                    setNotice(`${o.name} is ${editRole}${roleNeedsCrane(editRole) ? ` on ${editCranes.join(", ")}` : ""}`);
                    setEditId(null);
                    setEditConfirm(false);
                    load();
                  }
                }}
              >
                <RoleSelect value={editRole} onChange={setEditRole} />
                {roleNeedsCrane(editRole) ? <CranePicks slugs={slugs} value={editCranes} onChange={setEditCranes} /> : null}
                <label className="flex items-center gap-2 text-amber-200">
                  <input type="checkbox" checked={editConfirm} onChange={(e) => setEditConfirm(e.target.checked)} />
                  I am changing this operator's access
                </label>
                <button
                  type="submit"
                  disabled={busy || !editConfirm || (roleNeedsCrane(editRole) && editCranes.length === 0)}
                  className="rounded border border-amber-800/80 px-2 py-1 text-amber-200 disabled:opacity-50"
                >
                  save access
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setEditConfirm(false);
                  }}
                  className="text-zinc-500"
                >
                  cancel
                </button>
              </form>
            ) : null}
            {admin && removeId === o.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
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
            ) : null}
          </li>
        ))}
      </ul>

      {admin ? (
        <form
          className="flex max-w-md flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (passphrase !== confirmPass) {
              setErr("passphrases do not match");
              return;
            }
            if (
              await post({
                op: "add",
                name,
                passphrase,
                role: addRole,
                cranes: roleNeedsCrane(addRole) ? addCranes : [],
                confirm: addConfirm,
              })
            ) {
              setNotice(`added ${name} (${addRole})`);
              setName("");
              setPassphrase("");
              setConfirmPass("");
              setAddConfirm(false);
              setAddCranes([]);
              load();
            }
          }}
        >
          <h2 className="text-sm font-medium text-zinc-400">Add an operator</h2>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            name
            <input
              className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]{2,32}"
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
              maxLength={128}
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
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <RoleSelect value={addRole} onChange={setAddRole} />
          {roleNeedsCrane(addRole) ? <CranePicks slugs={slugs} value={addCranes} onChange={setAddCranes} /> : null}
          <label className="flex items-center gap-2 text-xs text-amber-200">
            <input type="checkbox" checked={addConfirm} onChange={(e) => setAddConfirm(e.target.checked)} />
            I am adding this operator
          </label>
          <button
            type="submit"
            disabled={busy || !addConfirm || (roleNeedsCrane(addRole) && addCranes.length === 0)}
            className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50"
          >
            Add operator
          </button>
        </form>
      ) : null}
      </>
      ) : null}
    </section>
  );
}


function YardPane({ admin }: { admin: boolean }) {
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
    return <p className="text-sm text-zinc-500">{err || "loading yard prefs…"}</p>;
  }

  return (
    <form className="flex max-w-lg flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4" onSubmit={save}>
      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      {notice ? <p className="text-sm text-zinc-300">{notice}</p> : null}
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        host retain days
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          type="number"
          min={1}
          max={90}
          value={hostDays}
          disabled={!admin}
          onChange={(e) => setHostDays(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        turn retain days
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          type="number"
          min={1}
          max={120}
          value={turnDays}
          disabled={!admin}
          onChange={(e) => setTurnDays(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        timezone
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={timezone}
          disabled={!admin}
          placeholder="America/Los_Angeles — blank = local"
          onChange={(e) => setTimezone(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        default image pin
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={image}
          disabled={!admin}
          onChange={(e) => setImage(e.target.value)}
        />
        <span>New cranes only. Existing compose tags stay until you pin/recreate.</span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        prompt $/1M
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={prompt}
          disabled={!admin}
          inputMode="decimal"
          placeholder="calculator only — not a bill"
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        gen $/1M
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={gen}
          disabled={!admin}
          inputMode="decimal"
          placeholder="optional"
          onChange={(e) => setGen(e.target.value)}
        />
      </label>
      <p className="text-[11px] text-zinc-600">
        Session idle (7 days) and absolute (30 days) stay in the door code — not toml. See docs/security.md.
      </p>
      {admin ? (
        <>
          <label className="flex items-center gap-2 text-xs text-amber-200">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            {shrink ? "I am shortening retain — older sqlite samples will be deleted" : "I am saving yard observe prefs"}
          </label>
          <button
            type="submit"
            disabled={busy || !confirm}
            className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-200 hover:border-amber-600 disabled:opacity-50"
          >
            Save yard prefs
          </button>
        </>
      ) : (
        <p className="text-xs text-zinc-500">Rates are visible so spend $ matches. Only admin can write.</p>
      )}
    </form>
  );
}

function RoleSelect({ value, onChange }: { value: OperatorRole; onChange: (role: OperatorRole) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      role
      <select
        className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
        value={value}
        onChange={(e) => onChange(e.target.value as OperatorRole)}
      >
        {OPERATOR_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </label>
  );
}

function CranePicks({ slugs, value, onChange }: { slugs: string[]; value: string[]; onChange: (next: string[]) => void }) {
  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }
  if (slugs.length === 0) {
    return (
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        cranes
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={value.join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(/[,\s]+/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
            )
          }
          required
          placeholder="kit, tryout"
        />
      </label>
    );
  }
  return (
    <fieldset className="flex flex-col gap-1 text-xs text-zinc-500">
      <legend>cranes</legend>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {slugs.map((slug) => (
          <li key={slug}>
            <label className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-stone-100">
              <input type="checkbox" checked={value.includes(slug)} onChange={() => toggle(slug)} />
              {slug}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
