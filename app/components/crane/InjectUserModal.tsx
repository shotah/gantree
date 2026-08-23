"use client";

import { useEffect, useState } from "react";
import {
  defaultFieldSelection,
  injectOperatorIntoPersona,
  operatorFieldValue,
  PERSONA_OPERATOR_FIELDS,
  type PersonaOperator,
  type PersonaOperatorField,
} from "@/lib/yard/crane/injectPersona";
import { emptyChannels, type OperatorChannels } from "@/lib/yard/door/channels";
import { HINTS } from "@/lib/yard/hints";
import { yardFetch } from "@/app/lib/yardFetch";
import { YardModal } from "../shared/YardModal";

type OperatorOption = {
  id: string;
  name: string;
  displayName: string;
  email?: string;
  description?: string;
  channels?: OperatorChannels;
};

export function InjectUserModal({
  persona,
  onClose,
  onInject,
}: {
  persona: string;
  onClose: () => void;
  onInject: (next: string, label: string) => void;
}) {
  const [operators, setOperators] = useState<OperatorOption[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [fields, setFields] = useState<PersonaOperatorField[]>([]);

  useEffect(() => {
    let live = true;
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: OperatorOption[]; you?: OperatorOption; error?: string }) => {
        if (!live) {
          return;
        }
        if (d.error) {
          setErr(d.error);
          setOperators([]);
          return;
        }
        const list = d.operators ?? [];
        setOperators(list);
        const prefer = d.you?.id && list.some((o) => o.id === d.you?.id) ? d.you.id : (list[0]?.id ?? "");
        setSelectedId(prefer);
        const op = list.find((o) => o.id === prefer);
        if (op) {
          setFields(defaultFieldSelection(asPersonaOperator(op)));
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setErr(e instanceof Error ? e.message : String(e));
          setOperators([]);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const op = operators?.find((o) => o.id === selectedId);
  const personaOp = op ? asPersonaOperator(op) : null;
  const canInject = Boolean(personaOp && fields.some((k) => operatorFieldValue(personaOp, k)));

  function pickOperator(id: string) {
    setSelectedId(id);
    const next = operators?.find((o) => o.id === id);
    setFields(next ? defaultFieldSelection(asPersonaOperator(next)) : []);
  }

  function toggle(key: PersonaOperatorField, on: boolean) {
    setFields((cur) => (on ? [...cur, key] : cur.filter((k) => k !== key)));
  }

  return (
    <YardModal
      title="Inject user into PERSONA.md"
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canInject}
            onClick={() => {
              if (!personaOp || !op) {
                return;
              }
              onInject(injectOperatorIntoPersona(persona, personaOp, fields), op.displayName || op.name);
            }}
            className="rounded border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-50"
          >
            Inject
          </button>
        </>
      )}
    >
      <p className="text-xs text-zinc-500">{HINTS.injectUser.hint}</p>

      {err ? <p className="mt-3 text-sm text-amber-200">{err}</p> : null}
      {operators === null ? <p className="mt-3 text-sm text-zinc-500">loading operators…</p> : null}
      {operators && operators.length === 0 && !err
        ? (
            <p className="mt-3 text-sm text-zinc-500">no operators on this yard</p>
          )
        : null}

      {operators && operators.length > 0
        ? (
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                operator
                <select
                  autoFocus
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-stone-100"
                  value={selectedId}
                  onChange={(e) => pickOperator(e.target.value)}
                >
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName || o.name}
                      {o.displayName && o.displayName !== o.name ? ` (${o.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs text-zinc-500">fields</legend>
                {PERSONA_OPERATOR_FIELDS.map((f) => {
                  const value = personaOp ? operatorFieldValue(personaOp, f.key) : "";
                  const checked = fields.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-start gap-2 text-sm ${value ? "text-stone-200" : "text-zinc-600"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        disabled={!value}
                        onChange={(e) => toggle(f.key, e.target.checked)}
                      />
                      <span>
                        <span className="text-zinc-400">{f.label}</span>
                        <span className="mt-0.5 block font-mono text-xs text-zinc-500">{value || "not set"}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </div>
          )
        : null}
    </YardModal>
  );
}

function asPersonaOperator(o: OperatorOption): PersonaOperator {
  return {
    displayName: (o.displayName || o.name).trim(),
    email: o.email ?? "",
    description: o.description ?? "",
    channels: { ...emptyChannels(), ...o.channels },
  };
}
