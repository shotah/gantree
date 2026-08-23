import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const AVATAR_FILE = "avatar.jpg";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const CANDIDATES = ["avatar.jpg", "avatar.jpeg", "avatar.png", "avatar.webp"] as const;

const MIME: Record<string, string> = {
  "avatar.jpg": "image/jpeg",
  "avatar.jpeg": "image/jpeg",
  "avatar.png": "image/png",
  "avatar.webp": "image/webp",
};

export type AvatarFile = { path: string; name: string; rev: number; type: string };

export type TelegramPoster = (
  url: string,
  init: { method: string; body: FormData; signal?: AbortSignal },
) => Promise<{ status: number; body: string }>;

export type AvatarApply = {
  detail: string;
  telegram: "updated" | "skipped" | "failed";
  rev: number;
};

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

export function acceptJpeg(bytes: Uint8Array): { ok: true } | { ok: false; detail: string } {
  if (bytes.byteLength < 32) {
    return { ok: false, detail: "image too small" };
  }
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, detail: "image too large (max 5MB)" };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, detail: "need a JPEG (the console converts PNG/WebP on upload)" };
  }
  return { ok: true };
}

export function findAvatar(personaDir: string | null): AvatarFile | null {
  if (!personaDir) {
    return null;
  }
  for (const name of CANDIDATES) {
    const path = resolve(personaDir, name);
    if (!existsSync(path)) {
      continue;
    }
    const st = statSync(path);
    if (!st.isFile() || st.size < 1) {
      continue;
    }
    return { path, name, rev: Math.trunc(st.mtimeMs), type: MIME[name] ?? "application/octet-stream" };
  }
  return null;
}

export function saveAvatar(personaDir: string, bytes: Uint8Array): AvatarFile {
  mkdirSync(personaDir, { recursive: true });
  const path = resolve(personaDir, AVATAR_FILE);
  writeFileSync(path, bytes);
  const hit = findAvatar(personaDir);
  if (!hit) {
    throw new Error("avatar write vanished");
  }
  return hit;
}

export function copyAvatarTo(personaDir: string | null, destDir: string): void {
  const hit = findAvatar(personaDir);
  if (!hit) {
    return;
  }
  copyFileSync(hit.path, resolve(destDir, hit.name));
}

export async function setTelegramProfilePhoto(
  token: string,
  jpeg: Uint8Array,
  post: TelegramPoster = telegramPost,
): Promise<{ ok: boolean; detail: string }> {
  const t = token.trim();
  if (!t) {
    return { ok: false, detail: "no TELEGRAM_BOT_TOKEN" };
  }
  const form = new FormData();
  form.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
  const copy = new Uint8Array(jpeg.byteLength);
  copy.set(jpeg);
  form.append("avatar", new Blob([copy], { type: "image/jpeg" }), "avatar.jpg");
  const url = `https://api.telegram.org/bot${t}/setMyProfilePhoto`;
  try {
    const res = await post(url, { method: "POST", body: form, signal: AbortSignal.timeout(15_000) });
    if (telegramOk(res.body)) {
      return { ok: true, detail: "Telegram profile photo updated" };
    }
    return { ok: false, detail: telegramDetail(t, res.body) };
  } catch (err) {
    return { ok: false, detail: redact(t, err instanceof Error ? err.message : String(err)) };
  }
}

export async function applyAvatar(opts: {
  personaDir: string;
  channel: string | null;
  token: string | null;
  bytes: Uint8Array;
  post?: TelegramPoster;
}): Promise<AvatarApply> {
  const saved = saveAvatar(opts.personaDir, opts.bytes);
  if (!shouldPushTelegram(opts.channel)) {
    return { detail: "saved avatar.jpg", telegram: "skipped", rev: saved.rev };
  }
  const token = opts.token?.trim() || "";
  if (!token) {
    return { detail: "saved avatar.jpg; Telegram skipped (no TELEGRAM_BOT_TOKEN)", telegram: "skipped", rev: saved.rev };
  }
  const tg = await setTelegramProfilePhoto(token, opts.bytes, opts.post ?? telegramPost);
  if (tg.ok) {
    return { detail: "saved avatar.jpg; Telegram profile photo updated", telegram: "updated", rev: saved.rev };
  }
  return { detail: `saved avatar.jpg; Telegram: ${tg.detail}`, telegram: "failed", rev: saved.rev };
}

export async function telegramPost(
  url: string,
  init: { method: string; body: FormData; signal?: AbortSignal },
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
}

function telegramOk(body: string): boolean {
  try {
    return (JSON.parse(body) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

function telegramDetail(token: string, body: string): string {
  let raw = body.trim() || "empty Telegram response";
  try {
    const j = JSON.parse(body) as { description?: unknown };
    if (typeof j.description === "string" && j.description.trim()) {
      raw = j.description;
    }
  } catch {
    /* keep raw */
  }
  return redact(token, raw).slice(0, 240);
}

function redact(token: string, text: string): string {
  return token ? text.split(token).join("***") : text;
}
