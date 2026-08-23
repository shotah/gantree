import { inspectByName } from "../host/docker";
import { loadEnvFile, mergeEnv, writeEnvFile } from "../host/envfile";
import {
  applyBotProfile,
  emptySnapshot,
  envListValue,
  formatAllowlist,
  getBotProfile,
  parseAllowlist,
  resolveChannelAndToken,
  seenUsers,
  shouldPushTelegram,
  type BotProfilePatch,
  type TelegramPoster,
  type TelegramSnapshot,
} from "../host/telegram";
import { peekTurns, sampleTurns } from "../observe/stats";
import { getGantry } from "./inventory";
import type { GantryCard } from "../types";

export async function craneTelegramAuth(g: GantryCard): Promise<{
  channel: string | null;
  token: string | null;
  allowlist: string[];
}> {
  const file = loadEnvFile(g.envFile);
  let inspectEnv: string[] | null = null;
  const haveChannel = Boolean((g.channel || file.CHANNEL || "").trim());
  const haveToken = Boolean((file.TELEGRAM_BOT_TOKEN || "").trim());
  if (!haveChannel || !haveToken) {
    try {
      const inspected = await inspectByName(g.containerId || g.containerName);
      inspectEnv = inspected?.info.Config.Env ?? null;
    } catch {
      inspectEnv = null;
    }
  }
  const { channel, token } = resolveChannelAndToken({
    cardChannel: g.channel,
    file,
    inspectEnv,
  });
  const allowRaw = file.TELEGRAM_ALLOWED_USERS || envListValue(inspectEnv, "TELEGRAM_ALLOWED_USERS");
  return { channel, token, allowlist: parseAllowlist(allowRaw) };
}

export async function telegramSnapshot(slug: string, post?: TelegramPoster): Promise<TelegramSnapshot | null> {
  const g = await getGantry(slug);
  if (!g) {
    return null;
  }
  await sampleTurns(slug).catch(() => []);
  const seen = seenUsers(peekTurns(slug));
  const auth = await craneTelegramAuth(g);
  if (!shouldPushTelegram(auth.channel)) {
    return emptySnapshot({ seen, allowlist: auth.allowlist, detail: "not telegram" });
  }
  if (!auth.token) {
    return emptySnapshot({
      enabled: true,
      tokenSet: false,
      allowlist: auth.allowlist,
      seen,
      detail: "no TELEGRAM_BOT_TOKEN",
    });
  }
  const profile = await getBotProfile(auth.token, post);
  return {
    enabled: true,
    tokenSet: true,
    bot: profile.bot,
    name: profile.name,
    description: profile.description,
    shortDescription: profile.shortDescription,
    commands: profile.commands,
    allowlist: auth.allowlist,
    seen,
    link: profile.link,
    detail: profile.detail,
  };
}

export async function pushTelegramProfile(
  slug: string,
  patch: BotProfilePatch,
  post?: TelegramPoster,
): Promise<{ ok: boolean; detail: string }> {
  const g = await getGantry(slug);
  if (!g) {
    return { ok: false, detail: "not found" };
  }
  const auth = await craneTelegramAuth(g);
  if (!shouldPushTelegram(auth.channel)) {
    return { ok: false, detail: "not telegram" };
  }
  if (!auth.token) {
    return { ok: false, detail: "no TELEGRAM_BOT_TOKEN" };
  }
  return applyBotProfile(auth.token, patch, post);
}

export async function saveGantryAllowlist(
  slug: string,
  ids: string[],
): Promise<{ ok: boolean; detail: string; allowlist: string[] }> {
  const g = await getGantry(slug);
  if (!g) {
    return { ok: false, detail: "not found", allowlist: [] };
  }
  if (!g.envFile) {
    return { ok: false, detail: "no env_file", allowlist: [] };
  }
  const auth = await craneTelegramAuth(g);
  if (!shouldPushTelegram(auth.channel)) {
    return { ok: false, detail: "not telegram", allowlist: [] };
  }
  const allowlist = parseAllowlist(ids);
  writeEnvFile(g.envFile, mergeEnv(loadEnvFile(g.envFile), { TELEGRAM_ALLOWED_USERS: formatAllowlist(allowlist) }));
  return {
    ok: true,
    detail: `allowlist ${allowlist.length} id(s) — recreate to apply (do not just restart)`,
    allowlist,
  };
}
