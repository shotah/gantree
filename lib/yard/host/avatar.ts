import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  redactToken,
  shouldPushTelegram,
  telegramDetail,
  telegramOk,
  telegramPost,
  type TelegramPoster,
} from "./telegram";

export { resolveChannelAndToken, shouldPushTelegram, telegramPost, type TelegramPoster } from "./telegram";

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

export type AvatarApply = {
  detail: string;
  telegram: "updated" | "skipped" | "failed";
  rev: number;
};

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
    return { ok: false, detail: redactToken(t, err instanceof Error ? err.message : String(err)) };
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
