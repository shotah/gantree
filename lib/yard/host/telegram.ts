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

const COMMAND_RE = /^[a-z0-9_]{1,32}$/;
const ID_RE = /^-?\d+$/;

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

const NEW_NUDGE =
  "Long thread. Tap /new to distill it and start fresh — I keep who I am; this chat's history folds away.";

/** One-tap /new in her DM. Telegram will not let the yard send as her. */
export async function sendTelegramNewNudge(
  token: string,
  dest: TelegramChatDest,
  post: TelegramPoster = telegramPost,
): Promise<{ ok: boolean; detail: string }> {
  if (!ID_RE.test(dest.chatId)) {
    return { ok: false, detail: "need a numeric Telegram chat id" };
  }
  const params: Record<string, unknown> = {
    chat_id: Number(dest.chatId),
    text: NEW_NUDGE,
    reply_markup: {
      keyboard: [[{ text: "/new" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  if (dest.threadId && dest.threadId > 0) {
    params.message_thread_id = dest.threadId;
  }
  const r = await telegramMethod(token, "sendMessage", params, post);
  return r.ok ? { ok: true, detail: `asked ${dest.chatId} to tap /new` } : { ok: false, detail: r.detail };
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

export async function telegramPost(url: string, init: TelegramInit): Promise<{ status: number; body: string }> {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
}

export function telegramOk(body: string): boolean {
  try {
    return (JSON.parse(body) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

export function redactToken(token: string, text: string): string {
  return token ? text.split(token).join("***") : text;
}

export function telegramDetail(token: string, body: string): string {
  let raw = body.trim() || "empty Telegram response";
  try {
    const j = JSON.parse(body) as { description?: unknown };
    if (typeof j.description === "string" && j.description.trim()) {
      raw = j.description;
    }
  } catch {
    /* keep raw */
  }
  return redactToken(token, raw).slice(0, 240);
}

export async function telegramMethod(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  post: TelegramPoster = telegramPost,
): Promise<{ ok: boolean; result: unknown; detail: string }> {
  const t = token.trim();
  if (!t) {
    return { ok: false, result: null, detail: "no TELEGRAM_BOT_TOKEN" };
  }
  const url = `https://api.telegram.org/bot${t}/${method}`;
  try {
    const res = await post(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    try {
      const j = JSON.parse(res.body) as { ok?: boolean; result?: unknown; description?: unknown };
      if (j.ok === true) {
        return { ok: true, result: j.result ?? null, detail: "ok" };
      }
      const desc = typeof j.description === "string" && j.description.trim() ? j.description : res.body.trim() || "Telegram error";
      return { ok: false, result: null, detail: redactToken(t, desc).slice(0, 240) };
    } catch {
      return { ok: false, result: null, detail: telegramDetail(t, res.body) };
    }
  } catch (err) {
    return { ok: false, result: null, detail: redactToken(t, err instanceof Error ? err.message : String(err)) };
  }
}

export async function getMe(token: string, post: TelegramPoster = telegramPost): Promise<BotProfile> {
  const r = await telegramMethod(token, "getMe", {}, post);
  const bot = asBot(r.result);
  if (!r.ok || !bot) {
    return {
      ok: false,
      bot: null,
      name: "",
      description: "",
      shortDescription: "",
      commands: [],
      link: null,
      detail: r.ok ? "getMe returned no bot" : r.detail,
    };
  }
  return {
    ok: true,
    bot,
    name: bot.firstName,
    description: "",
    shortDescription: "",
    commands: [],
    link: botLink(bot.username),
    detail: bot.username ? `@${bot.username}` : `bot ${bot.id}`,
  };
}

export async function getBotProfile(token: string, post: TelegramPoster = telegramPost): Promise<BotProfile> {
  const [me, name, desc, short, cmds] = await Promise.all([
    telegramMethod(token, "getMe", {}, post),
    telegramMethod(token, "getMyName", {}, post),
    telegramMethod(token, "getMyDescription", {}, post),
    telegramMethod(token, "getMyShortDescription", {}, post),
    telegramMethod(token, "getMyCommands", {}, post),
  ]);
  const bot = asBot(me.result);
  if (!me.ok || !bot) {
    return {
      ok: false,
      bot: null,
      name: "",
      description: "",
      shortDescription: "",
      commands: [],
      link: null,
      detail: me.ok ? "getMe returned no bot" : me.detail,
    };
  }
  const misses: string[] = [];
  if (!name.ok) {
    misses.push(`name: ${name.detail}`);
  }
  if (!desc.ok) {
    misses.push(`description: ${desc.detail}`);
  }
  if (!short.ok) {
    misses.push(`about: ${short.detail}`);
  }
  if (!cmds.ok) {
    misses.push(`commands: ${cmds.detail}`);
  }
  return {
    ok: misses.length === 0,
    bot,
    name: strField(name.result, "name") || bot.firstName,
    description: strField(desc.result, "description"),
    shortDescription: strField(short.result, "short_description"),
    commands: asCommands(cmds.result),
    link: botLink(bot.username),
    detail: misses.length ? misses.join("; ") : bot.username ? `@${bot.username}` : `bot ${bot.id}`,
  };
}

export async function applyBotProfile(
  token: string,
  patch: BotProfilePatch,
  post: TelegramPoster = telegramPost,
): Promise<{ ok: boolean; detail: string }> {
  const steps: { method: string; params: Record<string, unknown> }[] = [];
  if (patch.name !== undefined) {
    if (patch.name.length > 64) {
      return { ok: false, detail: "name max 64 characters" };
    }
    steps.push({ method: "setMyName", params: { name: patch.name } });
  }
  if (patch.description !== undefined) {
    if (patch.description.length > 512) {
      return { ok: false, detail: "description max 512 characters" };
    }
    steps.push({ method: "setMyDescription", params: { description: patch.description } });
  }
  if (patch.shortDescription !== undefined) {
    if (patch.shortDescription.length > 120) {
      return { ok: false, detail: "about max 120 characters" };
    }
    steps.push({ method: "setMyShortDescription", params: { short_description: patch.shortDescription } });
  }
  if (patch.commands !== undefined) {
    if (patch.commands.length === 0) {
      steps.push({ method: "deleteMyCommands", params: {} });
    } else {
      const commands = parseCommandLines(formatCommandLines(patch.commands));
      if (commands.length === 0) {
        return { ok: false, detail: "commands must look like: tools - list granted MCP" };
      }
      steps.push({ method: "setMyCommands", params: { commands } });
    }
  }
  if (steps.length === 0) {
    return { ok: false, detail: "nothing to push" };
  }
  const parts: string[] = [];
  let ok = true;
  for (const step of steps) {
    const r = await telegramMethod(token, step.method, step.params, post);
    const label = step.method.replace(/^setMy|^deleteMy/, "").replace(/ShortDescription/, "about").toLowerCase();
    if (r.ok) {
      parts.push(label);
    } else {
      ok = false;
      parts.push(`${label}: ${r.detail}`);
    }
  }
  return { ok, detail: ok ? `Telegram ${parts.join(", ")} updated` : parts.join("; ") };
}

function asBot(result: unknown): TelegramBot | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const o = result as Record<string, unknown>;
  if (typeof o.id !== "number" || !Number.isFinite(o.id)) {
    return null;
  }
  return {
    id: o.id,
    username: typeof o.username === "string" && o.username.trim() ? o.username.trim() : null,
    firstName: typeof o.first_name === "string" ? o.first_name : "",
  };
}

function strField(result: unknown, key: string): string {
  if (!result || typeof result !== "object") {
    return "";
  }
  const v = (result as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function asCommands(result: unknown): TelegramCommand[] {
  if (!Array.isArray(result)) {
    return [];
  }
  const out: TelegramCommand[] = [];
  for (const row of result) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const command = typeof o.command === "string" ? o.command.toLowerCase() : "";
    const description = typeof o.description === "string" ? o.description : "";
    if (COMMAND_RE.test(command) && description) {
      out.push({ command, description: description.slice(0, 256) });
    }
  }
  return out;
}
