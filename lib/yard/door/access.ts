import type { YardInventory } from "../types";
import type { OperatorRole } from "./channels";
import { parseRole } from "./channels";

export const OPERATOR_ROLES = ["admin", "user", "readonly"] as const;

export const ROLE_BLURB: Record<OperatorRole, string> = {
  admin: "full access — every crane, operators, build",
  user: "one crane — grant, recreate, env; not operators",
  readonly: "look — board, logs, doctor; not touch",
};

const CRANE_SLUG = /^[a-z][a-z0-9-]{0,31}$/;

/** Session / row shape the checks need. Not the full operator row. */
export type AccessSubject = {
  role: OperatorRole;
  crane: string | null;
};

export function parseStoredRole(raw: string | null | undefined): OperatorRole {
  return parseRole(raw) ?? "admin";
}

export function parseCraneSlug(raw: unknown): { ok: true; crane: string | null } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, crane: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "crane must be a slug" };
  }
  const s = raw.trim().toLowerCase();
  if (!s) {
    return { ok: true, crane: null };
  }
  if (!CRANE_SLUG.test(s)) {
    return { ok: false, error: "crane must be a lowercase slug" };
  }
  return { ok: true, crane: s };
}

export function accessForRole(
  role: OperatorRole,
  crane: string | null,
): { ok: true; role: OperatorRole; crane: string | null } | { ok: false; error: string } {
  if (role === "user") {
    if (!crane) {
      return { ok: false, error: "user role needs one crane" };
    }
    return { ok: true, role, crane };
  }
  return { ok: true, role, crane: null };
}

export function canReadCrane(op: AccessSubject, slug: string): boolean {
  if (op.role === "user") {
    return Boolean(op.crane) && op.crane === slug;
  }
  return true;
}

export function canMutateCrane(op: AccessSubject, slug: string): boolean {
  if (op.role === "admin") {
    return true;
  }
  if (op.role === "user") {
    return Boolean(op.crane) && op.crane === slug;
  }
  return false;
}

export function canBuildCrane(op: AccessSubject): boolean {
  return op.role === "admin";
}

export function canManageOperators(op: AccessSubject): boolean {
  return op.role === "admin";
}

export function scopeYard(yard: YardInventory, op: AccessSubject): YardInventory {
  if (op.role !== "user") {
    return yard;
  }
  return { ...yard, gantries: yard.gantries.filter((g) => g.slug === op.crane) };
}
