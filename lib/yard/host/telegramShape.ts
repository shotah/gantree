export type TelegramInit = {
  method: string;
  body?: FormData | string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type TelegramPoster = (url: string, init: TelegramInit) => Promise<{ status: number; body: string }>;

export type TelegramBot = {
  id: number;
  username: string | null;
  firstName: string;
};

export type TelegramCommand = { command: string; description: string };

export type TelegramSeen = { id: string; turns: number; lastAt: number };

export type BotProfilePatch = {
  name?: string;
  description?: string;
  shortDescription?: string;
  commands?: TelegramCommand[];
};

export type BotProfile = {
  ok: boolean;
  bot: TelegramBot | null;
  name: string;
  description: string;
  shortDescription: string;
  commands: TelegramCommand[];
  link: string | null;
  detail: string;
};

export type TelegramSnapshot = {
  enabled: boolean;
  tokenSet: boolean;
  bot: TelegramBot | null;
  name: string;
  description: string;
  shortDescription: string;
  commands: TelegramCommand[];
  allowlist: string[];
  seen: TelegramSeen[];
  link: string | null;
  detail: string;
};

export const COMMAND_RE = /^[a-z0-9_]{1,32}$/;
export const ID_RE = /^-?\d+$/;

export const BOTFATHER_URL = "https://t.me/BotFather";

export type BotIdentity = { name: string; username: string };

/** Display name + @username for a /newbot walk. Username always ends in bot, 5–32 chars. */
export function suggestBotIdentity(slug: string): BotIdentity {
  const cleaned = (slug || "kit")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const name = (cleaned || "kit").slice(0, 64);
  if (name.endsWith("bot") && name.length >= 5 && name.length <= 32) {
    return { name, username: name };
  }
  const base = name.slice(0, 28).replace(/_+$/g, "") || "kit";
  return { name, username: `${base}_bot`.slice(0, 32) };
}

export function shouldPushTelegram(channel: string | null): boolean {
  return (channel ?? "").trim().toLowerCase() === "telegram";
}

export function envListValue(env: string[] | null | undefined, key: string): string | null {
  if (!env) {
    return null;
  }
  const row = env.find((e) => e.startsWith(`${key}=`));
  const v = row ? row.slice(key.length + 1).trim() : "";
  return v || null;
}

export function resolveChannelAndToken(opts: {
  cardChannel: string | null;
  file: Record<string, string>;
  inspectEnv?: string[] | null;
}): { channel: string | null; token: string | null } {
  let channel = opts.cardChannel?.trim() || opts.file.CHANNEL?.trim() || envListValue(opts.inspectEnv, "CHANNEL");
  const token = opts.file.TELEGRAM_BOT_TOKEN?.trim() || envListValue(opts.inspectEnv, "TELEGRAM_BOT_TOKEN");
  if (!channel && token) {
    channel = "telegram";
  }
  return { channel: channel || null, token: token || null };
}

export function parseAllowlist(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : (raw ?? "").split(/[,\s]+/);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const id = p.trim();
    if (!ID_RE.test(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function formatAllowlist(ids: string[]): string {
  return parseAllowlist(ids).join(",");
}

export function parseCommandLines(text: string): TelegramCommand[] {
  const out: TelegramCommand[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    const m = t.match(/^\/?([a-z0-9_]+)\s*[-–—:]\s*(.+)$/i);
    const command = (m ? m[1] : t.replace(/^\//, "")).toLowerCase();
    const description = (m ? m[2] : command).trim().slice(0, 256);
    if (!COMMAND_RE.test(command) || seen.has(command) || !description) {
      continue;
    }
    seen.add(command);
    out.push({ command, description });
    if (out.length >= 100) {
      break;
    }
  }
  return out;
}

export function formatCommandLines(cmds: TelegramCommand[]): string {
  return cmds.map((c) => `${c.command} - ${c.description}`).join("\n");
}

/** Same / menu the harness registers on Telegram start — /new first so it is obvious. */
export const TELEGRAM_NEW_COMMAND: TelegramCommand = {
  command: "new",
  description: "Distill this thread and start fresh",
};

export const GANTRY_TELEGRAM_COMMANDS: TelegramCommand[] = [
  TELEGRAM_NEW_COMMAND,
  { command: "cancel", description: "Cancel the in-flight reply / tool loop" },
  { command: "status", description: "Uptime, model, history, tools, turns" },
  { command: "tools", description: "Prefixed tool catalog" },
  { command: "examples", description: "Capability idea (/examples on|off)" },
  { command: "perf", description: "Last turns: invocations, tools, batch" },
  { command: "memstats", description: "Memory row counts and consolidation" },
  { command: "toolstats", description: "Per-tool call ledger since boot" },
  { command: "tokens", description: "Prompt token breakdown (estimates)" },
  { command: "auth", description: "Remote OAuth (URL / paste code)" },
  { command: "help", description: "List commands" },
];

/** Keep /new on a custom menu. Empty list → the harness defaults (so the / menu is not a blank). */
export function ensureTelegramNew(cmds: TelegramCommand[]): TelegramCommand[] {
  const have = cmds.filter((c) => COMMAND_RE.test(c.command) && c.description.trim());
  if (have.some((c) => c.command === "new")) {
    return have;
  }
  if (have.length === 0) {
    return GANTRY_TELEGRAM_COMMANDS;
  }
  return [TELEGRAM_NEW_COMMAND, ...have];
}

export type TelegramChatDest = { chatId: string; threadId?: number };

/** DM chat id is the user id. Group/topic sessions are telegram:chat:user[:thread]. */
export function telegramChatForUser(
  userId: string,
  turns: { userId: string | null; sessionId: string | null; at: number }[],
): TelegramChatDest {
  const id = userId.trim();
  const hits = turns
    .filter((t) => t.userId?.trim() === id && t.sessionId)
    .sort((a, b) => b.at - a.at);
  const parts = (hits[0]?.sessionId ?? "").split(":");
  if (parts[0] === "telegram" && ID_RE.test(parts[1] ?? "") && parts[2] === id) {
    const thread = parts[3] && ID_RE.test(parts[3]) ? Number(parts[3]) : 0;
    return thread > 0 ? { chatId: parts[1], threadId: thread } : { chatId: parts[1] };
  }
  return { chatId: id };
}

export function seenUsers(turns: { userId: string | null; at: number }[]): TelegramSeen[] {
  const map = new Map<string, { turns: number; lastAt: number }>();
  for (const t of turns) {
    const id = t.userId?.trim() ?? "";
    if (!ID_RE.test(id)) {
      continue;
    }
    const cur = map.get(id) ?? { turns: 0, lastAt: 0 };
    cur.turns += 1;
    if (t.at > cur.lastAt) {
      cur.lastAt = t.at;
    }
    map.set(id, cur);
  }
  return [...map.entries()]
    .map(([id, v]) => ({ id, turns: v.turns, lastAt: v.lastAt }))
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function botLink(username: string | null | undefined): string | null {
  const u = (username ?? "").trim().replace(/^@/, "");
  return u ? `https://t.me/${u}` : null;
}

export function emptySnapshot(over: Partial<TelegramSnapshot> = {}): TelegramSnapshot {
  return {
    enabled: false,
    tokenSet: false,
    bot: null,
    name: "",
    description: "",
    shortDescription: "",
    commands: [],
    allowlist: [],
    seen: [],
    link: null,
    detail: "",
    ...over,
  };
}
