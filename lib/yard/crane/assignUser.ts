import { resolve } from "node:path";
import { loadEnvFile, mergeEnv, writeEnvFile } from "../host/envfile";
import {
  loadGantreeToml,
  loadTomlTagColors,
  mergeTomlTagColors,
  setTomlGantryTags,
  setTomlGantryUser,
  yardRoot,
} from "../host/files";
import {
  formatPendantAllowlist,
  formatPendantEntry,
  parsePendantAllowlist,
  pendantEntryForOperator,
} from "./pendantShape";
import { parseTag, TAG_MAX } from "./tags";

/** Enough of an operator to tag the board and fill the pendant allowlist. */
export type CraneUserOp = {
  id: string;
  name: string;
  email: string;
  channels: { google: string[] };
};

export type AssignCraneUserResult = {
  ok: true;
  user: string | null;
  tags: string[];
  pendant: "added" | "unchanged" | "no-email" | "no-env";
  detail: string;
} | { ok: false; error: string };

/**
 * One person per crane. Stores their id, tags their login name on the board,
 * and adds their email (or sub:email) to the pendant allowlist.
 * Clearing drops the tag and leaves the allowlist.
 */
export function assignCraneUser(
  slug: string,
  operator: CraneUserOp | null,
  opts?: { previousName?: string | null },
): AssignCraneUserResult {
  const doc = loadGantreeToml();
  const row = doc?.gantry?.find((g) => g.slug === slug);
  if (!row) {
    return { ok: false, error: "user lives in gantree.toml — this crane is not in inventory" };
  }
  const swapped = withUserTag(row.tags ?? [], opts?.previousName ?? null, operator?.name ?? null);
  if (!setTomlGantryTags(slug, swapped.tags)) {
    return { ok: false, error: "user lives in gantree.toml — this crane is not in inventory" };
  }
  if (!setTomlGantryUser(slug, operator?.id ?? null)) {
    return { ok: false, error: "user lives in gantree.toml — this crane is not in inventory" };
  }
  const tag = operator ? parseTag(operator.name) : null;
  if (tag && swapped.tags.includes(tag) && !loadTomlTagColors()[tag]) {
    mergeTomlTagColors({ [tag]: "sky" });
  }
  const pendant = operator ? writePendant(row.env_file, operator) : "unchanged";
  return {
    ok: true,
    user: operator?.id ?? null,
    tags: swapped.tags,
    pendant: operator ? pendant : "unchanged",
    detail: assignDetail(operator, swapped.note, tag, pendant),
  };
}

/** Re-tag and refresh the pendant entry after a profile rename or email change. */
export function refreshAssignedCranes(operator: CraneUserOp, previousName: string): void {
  const doc = loadGantreeToml();
  for (const row of doc?.gantry ?? []) {
    if (row.user === operator.id) {
      assignCraneUser(row.slug, operator, { previousName });
    }
  }
}

/** Drop a deleted operator off every crane. The pendant allowlist stays. */
export function detachOperatorFromCranes(operator: CraneUserOp): void {
  const doc = loadGantreeToml();
  for (const row of doc?.gantry ?? []) {
    if (row.user === operator.id) {
      assignCraneUser(row.slug, null, { previousName: operator.name });
    }
  }
}

function withUserTag(
  tags: string[],
  previousName: string | null,
  nextName: string | null,
): { tags: string[]; note: string | null } {
  const prev = previousName ? parseTag(previousName) : null;
  const out = prev ? tags.filter((t) => t !== prev) : [...tags];
  if (!nextName) {
    return { tags: out, note: null };
  }
  const next = parseTag(nextName);
  if (!next) {
    return { tags: out, note: "login name is not a board tag" };
  }
  if (out.includes(next)) {
    return { tags: out, note: null };
  }
  if (out.length >= TAG_MAX) {
    return { tags: out, note: `at most ${TAG_MAX} tags` };
  }
  return { tags: [...out, next], note: null };
}

function writePendant(envFile: string | undefined, operator: CraneUserOp): "added" | "unchanged" | "no-email" | "no-env" {
  const made = pendantEntryForOperator(operator);
  if (!made.ok) {
    return "no-email";
  }
  if (!envFile) {
    return "no-env";
  }
  const path = resolve(yardRoot(), envFile);
  const env = loadEnvFile(path);
  const before = formatPendantAllowlist(parsePendantAllowlist(env.PENDANT_ALLOWED_USERS));
  const google = new Set(operator.channels.google);
  const email = operator.email.trim().toLowerCase();
  const kept = parsePendantAllowlist(env.PENDANT_ALLOWED_USERS).filter((e) => {
    if (e.sub && google.has(e.sub)) {
      return false;
    }
    if (e.email && email && e.email === email) {
      return false;
    }
    return true;
  });
  const after = formatPendantAllowlist(parsePendantAllowlist([...kept.map(formatPendantEntry), made.entry]));
  if (after === before) {
    return "unchanged";
  }
  writeEnvFile(path, mergeEnv(env, { PENDANT_ALLOWED_USERS: after }));
  return "added";
}

function assignDetail(
  operator: CraneUserOp | null,
  note: string | null,
  tag: string | null,
  pendant: "added" | "unchanged" | "no-email" | "no-env",
): string {
  if (!operator) {
    return "cleared the user";
  }
  const bits = [`${operator.name} is the user`];
  if (note) {
    bits.push(note);
  } else if (tag) {
    bits.push(`tagged ${tag}`);
  }
  if (pendant === "added") {
    bits.push("pendant email saved — recreate to apply");
  } else if (pendant === "unchanged") {
    bits.push("pendant already had that email");
  } else if (pendant === "no-email") {
    bits.push("no email or Google sub on the profile");
  } else {
    bits.push("no env file for the pendant allowlist");
  }
  return bits.join("; ");
}
