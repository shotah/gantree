/** Board labels on a crane — whose keys, which house, not secrets. */

export const TAG_MAX = 8;
export const TAG_LEN = 24;
const TAG_RE = /^[a-z][a-z0-9._-]{0,23}$/;

/** Yard-wide hues. Same label keeps the same color on every card. */
export const TAG_COLORS = ["red", "green", "amber", "sky", "violet", "rose"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export type TagsResult = { ok: true; tags: string[] } | { ok: false; error: string };
export type TagColorsResult = { ok: true; colors: Record<string, TagColor> } | { ok: false; error: string };

function squeezeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function parseTag(raw: string): string | null {
  const t = squeezeTag(raw);
  if (!t || t.length > TAG_LEN || !TAG_RE.test(t)) {
    return null;
  }
  return t;
}

export function parseTagColor(raw: unknown): TagColor | null {
  if (typeof raw !== "string") {
    return null;
  }
  const c = raw.trim().toLowerCase();
  return (TAG_COLORS as readonly string[]).includes(c) ? (c as TagColor) : null;
}

/** Drop junk. Used when reading gantree.toml so a bad hand-edit cannot blank the yard. */
export function coerceTags(raw: unknown): string[] {
  const items = tagItems(raw);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items ?? []) {
    if (typeof item !== "string") {
      continue;
    }
    const t = parseTag(item);
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
    if (out.length >= TAG_MAX) {
      break;
    }
  }
  return out;
}

/** Drop unknown hues so a bad [tag_color] row cannot blank the board. */
export function coerceTagColors(raw: unknown): Record<string, TagColor> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, TagColor> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const t = parseTag(key);
    const c = parseTagColor(value);
    if (!t || !c) {
      continue;
    }
    out[t] = c;
  }
  return out;
}

/** Refuse junk so the operator sees why a label did not stick. */
export function parseTags(raw: unknown): TagsResult {
  if (raw == null) {
    return { ok: true, tags: [] };
  }
  const items = tagItems(raw);
  if (!items) {
    return { ok: false, error: "tags must be a list of labels" };
  }
  if (items.length > TAG_MAX) {
    return { ok: false, error: `at most ${TAG_MAX} tags` };
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string") {
      return { ok: false, error: "each tag must be a string" };
    }
    const t = parseTag(item);
    if (!t) {
      return {
        ok: false,
        error: `bad tag ${JSON.stringify(item.trim() || item)} — letter first, then letters, digits, . _ - (max ${TAG_LEN})`,
      };
    }
    if (seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return { ok: true, tags: out };
}

export function parseTagColors(raw: unknown): TagColorsResult {
  if (raw == null) {
    return { ok: true, colors: {} };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "tag colors must be a map of label to hue" };
  }
  const out: Record<string, TagColor> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const t = parseTag(key);
    if (!t) {
      return { ok: false, error: `bad tag ${JSON.stringify(key)} in tag colors` };
    }
    const c = parseTagColor(value);
    if (!c) {
      return { ok: false, error: `bad color for ${t} — use ${TAG_COLORS.join(", ")}` };
    }
    out[t] = c;
  }
  return { ok: true, colors: out };
}

function tagItems(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    return raw.split(/[,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return null;
}
