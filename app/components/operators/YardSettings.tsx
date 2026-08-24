"use client";

import { useCallback, useEffect, useState } from "react";
import { yardFetch } from "@/app/lib/yardFetch";
import { PeoplePane, type SettingsOperator } from "./PeoplePane";
import { YardPane } from "./YardPane";

export function YardSettings() {
  const [operators, setOperators] = useState<SettingsOperator[]>([]);
  const [you, setYou] = useState<SettingsOperator | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pane, setPane] = useState<"people" | "yard">("people");

  const admin = you?.role === "admin";

  const load = useCallback(() => {
    yardFetch("/api/operators")
      .then((r) => r.json())
      .then((d: { operators?: SettingsOperator[]; you?: SettingsOperator; error?: string }) => {
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

  return (
    <section className="flex flex-col gap-8" data-shot="settings">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-dim">
          {pane === "yard"
            ? "Retain, timezone, default pin, optional $/1M. Session idle stays in the door — not this table."
            : admin
              ? "Who is on this yard, and what they can touch. Edit for photo, email, chat ids, and passphrase."
              : "Your role is assigned by an admin. Photo and passphrase are on Profile."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-line pb-px">
        <button
          type="button"
          className={`rounded-t px-3 py-1.5 text-sm ${pane === "people" ? "border border-b-transparent border-edge bg-canvas text-fg" : "text-dim hover:text-body"}`}
          onClick={() => setPane("people")}
        >
          People
        </button>
        <button
          type="button"
          className={`rounded-t px-3 py-1.5 text-sm ${pane === "yard" ? "border border-b-transparent border-edge bg-canvas text-fg" : "text-dim hover:text-body"}`}
          onClick={() => setPane("yard")}
        >
          Yard
        </button>
      </div>

      {err ? <p className="text-sm text-mark">{err}</p> : null}

      {pane === "yard" ? <YardPane admin={admin} /> : null}

      {pane === "people"
        ? (
            <PeoplePane operators={operators} you={you} slugs={slugs} admin={admin} onChanged={load} />
          )
        : null}
    </section>
  );
}
