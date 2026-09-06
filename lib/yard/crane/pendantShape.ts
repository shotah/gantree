export type PendantAllowEntry = {
  sub: string | null;
  email: string | null;
};

export type PendantSnapshot = {
  enabled: boolean;
  mailboxUrl: string | null;
  bearerSet: boolean;
  allowlist: string[];
  seen: { id: string; turns: number; lastAt: number }[];
  suggestion: {
    userId: string;
    operatorId: string;
    operatorName: string;
    email: string;
  } | null;
  detail: string;
};

const SUB_RE = /^\d{10,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function shouldPushPendant(channel: string | null): boolean {
  return (channel ?? "").trim().toLowerCase() === "pendant";
}

export function parsePendantEntry(raw: string): PendantAllowEntry | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const colon = t.indexOf(":");
  if (colon >= 0) {
    const sub = t.slice(0, colon).trim();
    const email = t.slice(colon + 1).trim().toLowerCase();
    if (!SUB_RE.test(sub) || !EMAIL_RE.test(email)) {
      return null;
    }
    return { sub, email };
  }
  if (t.includes("@")) {
    const email = t.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return null;
    }
    return { sub: null, email };
  }
  if (SUB_RE.test(t)) {
    return { sub: t, email: null };
  }
  return null;
}

export function formatPendantEntry(entry: PendantAllowEntry): string {
  if (entry.sub && entry.email) {
    return `${entry.sub}:${entry.email}`;
  }
  if (entry.sub) {
    return entry.sub;
  }
  return entry.email ?? "";
}

export function parsePendantAllowlist(raw: string | string[] | null | undefined): PendantAllowEntry[] {
  const parts = Array.isArray(raw) ? raw : (raw ?? "").split(/[,\s]+/);
  const out: PendantAllowEntry[] = [];
  const seenSub = new Set<string>();
  const seenEmail = new Set<string>();
  for (const p of parts) {
    const entry = parsePendantEntry(p);
    if (!entry) {
      continue;
    }
    if (entry.sub && seenSub.has(entry.sub)) {
      continue;
    }
    if (entry.email && seenEmail.has(entry.email)) {
      continue;
    }
    if (entry.sub) {
      seenSub.add(entry.sub);
    }
    if (entry.email) {
      seenEmail.add(entry.email);
    }
    out.push(entry);
  }
  return out;
}

export function formatPendantAllowlist(entries: PendantAllowEntry[]): string {
  return entries.map(formatPendantEntry).filter(Boolean).join(",");
}

export function pendantEntryForOperator(op: {
  email?: string;
  channels: { google: string[] };
}): { ok: true; entry: string } | { ok: false; error: string } {
  const sub = op.channels.google.find((id) => SUB_RE.test(id)) ?? "";
  const email = (op.email ?? "").trim().toLowerCase();
  if (sub && email && EMAIL_RE.test(email)) {
    return { ok: true, entry: formatPendantEntry({ sub, email }) };
  }
  if (sub) {
    return { ok: true, entry: sub };
  }
  if (email && EMAIL_RE.test(email)) {
    return { ok: true, entry: email };
  }
  return { ok: false, error: "operator has neither Google sub nor email" };
}

export function operatorOnPendantList(
  op: { email?: string; channels: { google: string[] } },
  entries: PendantAllowEntry[],
): boolean {
  const google = new Set(op.channels.google);
  const email = (op.email ?? "").trim().toLowerCase();
  return entries.some((e) => (e.sub && google.has(e.sub)) || (e.email && email && e.email === email));
}
