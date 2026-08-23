"use client";

import { useState } from "react";
import { yardFetch } from "@/app/lib/yardFetch";
import { OPERATOR_ROLES, ROLE_BLURB, roleNeedsCrane } from "@/lib/yard/door/access";
import type { OperatorRole } from "@/lib/yard/door/channels";
import { HINTS } from "@/lib/yard/hints";
import { HintField, HintLegend } from "../shared/HintField";
import { OperatorAvatar } from "../shared/OperatorAvatar";

export type SettingsOperator = {
  id: string;
  name: string;
  displayName: string;
  role: OperatorRole;
  cranes: string[];
  avatarRev: number | null;
  createdAt: string;
};

export function PeoplePane({
  operators,
  you,
  slugs,
  admin,
  onChanged,
}: {
  operators: SettingsOperator[];
  you: SettingsOperator | null;
  slugs: string[];
  admin: boolean;
  onChanged: () => void;
}) {
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
              {admin
                ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {editId === o.id
                        ? null
                        : (
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
                      {removeId === o.id
                        ? null
                        : (
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
                  )
                : null}
            </div>
            {admin && editId === o.id
              ? (
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
                        onChanged();
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
                )
              : null}
            {admin && removeId === o.id
              ? (
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
                          onChanged();
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
                )
              : null}
          </li>
        ))}
      </ul>

      {admin
        ? (
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
                  onChanged();
                }
              }}
            >
              <h2 className="text-sm font-medium text-zinc-400">Add an operator</h2>
              <HintField label="name" {...HINTS.operatorName}>
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
              </HintField>
              <HintField label="passphrase" {...HINTS.operatorPass}>
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
              </HintField>
              <HintField label="confirm" {...HINTS.operatorConfirm}>
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
              </HintField>
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
          )
        : null}
    </>
  );
}

function RoleSelect({ value, onChange }: { value: OperatorRole; onChange: (role: OperatorRole) => void }) {
  return (
    <HintField label="role" {...HINTS.operatorRole}>
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
    </HintField>
  );
}

function CranePicks({ slugs, value, onChange }: { slugs: string[]; value: string[]; onChange: (next: string[]) => void }) {
  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }
  if (slugs.length === 0) {
    return (
      <HintField label="cranes" {...HINTS.operatorCranes}>
        <input
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-stone-100"
          value={value.join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(/[,\s]+/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
            )}
          required
          placeholder="kit, tryout"
        />
      </HintField>
    );
  }
  return (
    <HintLegend label="cranes" className="text-xs text-zinc-500" {...HINTS.operatorCranes}>
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
    </HintLegend>
  );
}
