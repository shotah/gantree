import type { YardInventory } from "../types";
import type { OperatorRole } from "./channels";
import { parseRole } from "./channels";

export const OPERATOR_ROLES = ["admin", "user", "readonly"] as const;

export const ROLE_BLURB: Record<OperatorRole, string> = {
  admin: "full access — every crane, operators, build",
  user: "assigned cranes — card and details; grant, recreate, env",
  readonly: "assigned cranes — look; not touch",
};

export const MAX_CRANES = 16;

const CRANE_SLUG = /^[a-z][a-z0-9-]{0,31}$/;

/** Session / row shape the checks need. Not the full operator row. */
export type AccessSubject = {
  role: OperatorRole;
  cranes: string[];
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

/** JSON list in sqlite, or a leftover single slug from before multi-assign. */
export function parseStoredCranes(raw: string | null | undefined): string[] {
  if (raw == null) {
    return [];
  }
  const s = raw.trim();
  if (!s) {
    return [];
  }
  if (s.startsWith("[")) {
    try {
      const v = JSON.parse(s) as unknown;
      const parsed = parseCraneSlugs(v);
      return parsed.ok ? parsed.cranes : [];
    } catch {
      return [];
    }
  }
  const one = parseCraneSlug(s);
  return one.ok && one.crane ? [one.crane] : [];
}

export function serializeCranes(cranes: string[]): string | null {
  return cranes.length === 0 ? null : JSON.stringify(cranes);
}

export function parseCraneSlugs(raw: unknown): { ok: true; cranes: string[] } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, cranes: [] };
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) {
      return { ok: true, cranes: [] };
    }
    if (s.startsWith("[")) {
      try {
        const v = JSON.parse(s) as unknown;
        if (!Array.isArray(v)) {
          return { ok: false, error: "cranes must be slugs" };
        }
        return finishSlugs(v);
      } catch {
        return { ok: false, error: "cranes must be slugs" };
      }
    }
    return finishSlugs(s.split(/[,\s]+/).filter(Boolean));
  }
  if (Array.isArray(raw)) {
    return finishSlugs(raw);
  }
  return { ok: false, error: "cranes must be slugs" };
}

function finishSlugs(raw: unknown[]): { ok: true; cranes: string[] } | { ok: false; error: string } {
  if (raw.length > MAX_CRANES) {
    return { ok: false, error: `at most ${MAX_CRANES} cranes` };
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const p = parseCraneSlug(item);
    if (!p.ok) {
      return { ok: false, error: p.error };
    }
    if (!p.crane || seen.has(p.crane)) {
      continue;
    }
    seen.add(p.crane);
    out.push(p.crane);
  }
  return { ok: true, cranes: out };
}

export function roleNeedsCrane(role: OperatorRole): boolean {
  return role !== "admin";
}

export function accessForRole(
  role: OperatorRole,
  cranes: unknown,
): { ok: true; role: OperatorRole; cranes: string[] } | { ok: false; error: string } {
  const parsed = parseCraneSlugs(cranes);
  if (!parsed.ok) {
    return parsed;
  }
  if (!roleNeedsCrane(role)) {
    return { ok: true, role, cranes: [] };
  }
  if (parsed.cranes.length === 0) {
    return { ok: false, error: `${role} role needs at least one crane` };
  }
  return { ok: true, role, cranes: parsed.cranes };
}

export function canReadCrane(op: AccessSubject, slug: string): boolean {
  if (op.role === "admin") {
    return true;
  }
  return op.cranes.includes(slug);
}

export function canMutateCrane(op: AccessSubject, slug: string): boolean {
  if (op.role === "admin") {
    return true;
  }
  if (op.role === "user") {
    return op.cranes.includes(slug);
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
  if (op.role === "admin") {
    return yard;
  }
  const allow = new Set(op.cranes);
  return { ...yard, gantries: yard.gantries.filter((g) => allow.has(g.slug)) };
}
