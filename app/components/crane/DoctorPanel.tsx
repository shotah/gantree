"use client";

import type { DoctorCheck, DoctorReport } from "@/lib/yard/types";
import { DashFold } from "../shared/DashFold";

function summary(doctor: DoctorReport | null, fails: number, n: number): string {
  if (!doctor) {
    return "loading…";
  }
  if (n === 0) {
    return "no checks";
  }
  if (fails > 0) {
    return `${fails} fail · ${n} check${n === 1 ? "" : "s"}`;
  }
  return `ok · ${n} check${n === 1 ? "" : "s"}`;
}

function hint(doctor: DoctorReport | null, fails: number, n: number): string {
  if (!doctor) {
    return "waiting for doctor — expand for detail";
  }
  if (fails > 0) {
    return `${fails} failing — expand for detail`;
  }
  if (n === 0) {
    return "no checks yet — expand for detail";
  }
  return "all checks ok — expand for detail";
}

function CheckRow({ c }: { c: DoctorCheck }) {
  return (
    <li className="flex gap-3 rounded border border-zinc-800 px-3 py-2 text-sm">
      <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "ok" : "fail"}</span>
      <span className="text-zinc-300">{c.detail}</span>
    </li>
  );
}

export function DoctorPanel({ doctor, persistKey }: { doctor: DoctorReport | null; persistKey?: string }) {
  const checks = doctor?.checks ?? [];
  const fails = checks.filter((c) => !c.ok).length;

  return (
    <DashFold
      title="Doctor"
      persistKey={persistKey}
      summary={(
        <span className={fails > 0 ? "text-red-400" : doctor ? "text-emerald-400" : "text-zinc-500"}>
          {summary(doctor, fails, checks.length)}
        </span>
      )}
      hint={hint(doctor, fails, checks.length)}
    >
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <CheckRow key={`${c.id}:${i}`} c={c} />
        ))}
      </ul>
    </DashFold>
  );
}
