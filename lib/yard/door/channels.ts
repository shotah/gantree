export const OPERATOR_CHANNEL_KINDS = ["telegram", "slack", "discord"] as const;
export type OperatorChannelKind = (typeof OPERATOR_CHANNEL_KINDS)[number];

export type OperatorRole = "admin" | "user" | "readonly";

export type OperatorChannels = {
  telegram: string[];
  slack: string[];
  discord: string[];
};

export const MAX_CHANNEL_IDS = 16;
export const MAX_DISPLAY_NAME = 64;
export const MAX_EMAIL = 254;
export const MAX_DESCRIPTION = 280;

const TELEGRAM_ID = /^-?\d+$/;
const DISCORD_ID = /^\d{5,20}$/;
const SLACK_ID = /^[A-Za-z][A-Za-z0-9._-]{2,63}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyChannels(): OperatorChannels {
  return { telegram: [], slack: [], discord: [] };
}

export function parseRole(raw: unknown): OperatorRole | null {
  return raw === "admin" || raw === "user" || raw === "readonly" ? raw : null;
}

export function validateDisplayName(raw: string): string | null {
  if (typeof raw !== "string") {
    return "display name required";
  }
  const s = raw.trim();
  if (s.length > MAX_DISPLAY_NAME) {
    return `display name must be at most ${MAX_DISPLAY_NAME} characters`;
  }
  if (/[\u0000-\u001f\u007f]/.test(s)) {
    return "display name cannot contain control characters";
  }
  return null;
}

export function validateEmail(raw: string): string | null {
  if (typeof raw !== "string") {
    return "email required";
  }
  const s = raw.trim();
  if (!s) {
    return null;
  }
  if (s.length > MAX_EMAIL) {
    return `email must be at most ${MAX_EMAIL} characters`;
  }
  if (!EMAIL_RE.test(s)) {
    return "email looks wrong";
  }
  return null;
}

export function validateDescription(raw: string): string | null {
  if (typeof raw !== "string") {
    return "description required";
  }
  if (raw.length > MAX_DESCRIPTION) {
    return `description must be at most ${MAX_DESCRIPTION} characters`;
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) {
    return "description cannot contain control characters";
  }
  return null;
}

export function parseChannelIds(
  kind: OperatorChannelKind,
  raw: string | string[] | null | undefined,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  const parts = Array.isArray(raw) ? raw : (raw ?? "").split(/[,\s]+/);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const id = p.trim();
    if (!id) {
      continue;
    }
    if (id.startsWith("@")) {
      return { ok: false, error: `${kind} needs the platform id, not @username` };
    }
    const ok = kind === "telegram" ? TELEGRAM_ID.test(id) : kind === "discord" ? DISCORD_ID.test(id) : SLACK_ID.test(id);
    if (!ok) {
      return {
        ok: false,
        error:
          kind === "slack"
            ? "slack ids look like U012ABCDEF, not @name"
            : `${kind} ids are numeric`,
      };
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length > MAX_CHANNEL_IDS) {
      return { ok: false, error: `at most ${MAX_CHANNEL_IDS} ${kind} ids` };
    }
  }
  return { ok: true, ids };
}

export function parseOperatorChannels(raw: unknown): OperatorChannels {
  const out = emptyChannels();
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) {
      return out;
    }
    try {
      obj = JSON.parse(t) as unknown;
    } catch {
      return out;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return out;
  }
  const rec = obj as Record<string, unknown>;
  for (const kind of OPERATOR_CHANNEL_KINDS) {
    const parsed = parseChannelIds(kind, rec[kind] as string | string[] | null | undefined);
    if (parsed.ok) {
      out[kind] = parsed.ids;
    }
  }
  return out;
}

export function serializeOperatorChannels(ch: OperatorChannels): string {
  const out = emptyChannels();
  for (const kind of OPERATOR_CHANNEL_KINDS) {
    const parsed = parseChannelIds(kind, ch[kind]);
    out[kind] = parsed.ok ? parsed.ids : [];
  }
  return JSON.stringify(out);
}

export function parseChannelsPatch(raw: unknown): { ok: true; channels: OperatorChannels } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, channels: emptyChannels() };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "channels must be an object" };
  }
  const rec = raw as Record<string, unknown>;
  const channels = emptyChannels();
  for (const kind of OPERATOR_CHANNEL_KINDS) {
    if (!(kind in rec)) {
      continue;
    }
    const parsed = parseChannelIds(kind, rec[kind] as string | string[] | null | undefined);
    if (!parsed.ok) {
      return parsed;
    }
    channels[kind] = parsed.ids;
  }
  return { ok: true, channels };
}
