import {
  botLink,
  COMMAND_RE,
  formatCommandLines,
  ID_RE,
  parseCommandLines,
  type BotProfile,
  type BotProfilePatch,
  type TelegramBot,
  type TelegramChatDest,
  type TelegramCommand,
  type TelegramInit,
  type TelegramPoster,
} from "./telegramShape";

const NEW_NUDGE
  = "Long thread. Tap /new to distill it and start fresh — I keep who I am; this chat's history folds away.";

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
