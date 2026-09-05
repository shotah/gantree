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
  pendant: "updated" | "skipped" | "failed";
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

export function shouldPushPendant(channel: string | null): boolean {
  return (channel ?? "").trim().toLowerCase() === "pendant";
}

const SLUG = /^[a-z][a-z0-9-]{0,31}$/;

/** `wss://…/ws/kit` → `https://…/api/avatar?slug=kit` */
export function mailboxToAvatarUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol === "wss:") {
    u.protocol = "https:";
  } else if (u.protocol === "ws:") {
    u.protocol = "http:";
  } else if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const slug = parts[0] === "ws" && parts[1] ? parts[1].trim().toLowerCase() : "";
  if (!SLUG.test(slug)) {
    return null;
  }
  u.pathname = "/api/avatar";
  u.search = "";
  u.hash = "";
  u.searchParams.set("slug", slug);
  return u.toString();
}

export async function setPendantProfilePhoto(
  mailboxUrl: string,
  bearer: string,
  jpeg: Uint8Array,
  post: TelegramPoster = telegramPost,
): Promise<{ ok: boolean; detail: string }> {
  const endpoint = mailboxToAvatarUrl(mailboxUrl);
  const t = bearer.trim();
  if (!endpoint) {
    return { ok: false, detail: "bad PENDANT_MAILBOX_URL" };
  }
  if (!t) {
    return { ok: false, detail: "no PENDANT_BEARER" };
  }
  const form = new FormData();
  const copy = new Uint8Array(jpeg.byteLength);
  copy.set(jpeg);
  form.append("file", new Blob([copy], { type: "image/jpeg" }), "avatar.jpg");
  try {
    const res = await post(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    try {
      const j = JSON.parse(res.body) as { ok?: boolean; detail?: unknown; error?: unknown };
      if (j.ok === true) {
        return { ok: true, detail: "pendant face updated" };
      }
      const err = typeof j.detail === "string" ? j.detail : typeof j.error === "string" ? j.error : res.body;
      return { ok: false, detail: redactToken(t, String(err || `HTTP ${res.status}`)).slice(0, 240) };
    } catch {
      return { ok: false, detail: redactToken(t, res.body.trim() || `HTTP ${res.status}`).slice(0, 240) };
    }
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
  mailboxUrl?: string | null;
  bearer?: string | null;
}): Promise<AvatarApply> {
  const saved = saveAvatar(opts.personaDir, opts.bytes);
  let telegram: AvatarApply["telegram"] = "skipped";
  let pendant: AvatarApply["pendant"] = "skipped";
  const notes = ["saved avatar.jpg"];
  const post = opts.post ?? telegramPost;

  if (shouldPushTelegram(opts.channel)) {
    const token = opts.token?.trim() || "";
    if (!token) {
      notes.push("Telegram skipped (no TELEGRAM_BOT_TOKEN)");
    } else {
      const tg = await setTelegramProfilePhoto(token, opts.bytes, post);
      if (tg.ok) {
        telegram = "updated";
        notes.push("Telegram profile photo updated");
      } else {
        telegram = "failed";
        notes.push(`Telegram: ${tg.detail}`);
      }
    }
  }

  if (shouldPushPendant(opts.channel)) {
    const mailboxUrl = opts.mailboxUrl?.trim() || "";
    const bearer = opts.bearer?.trim() || "";
    if (!mailboxUrl || !bearer) {
      notes.push("pendant skipped (no mailbox)");
    } else {
      const p = await setPendantProfilePhoto(mailboxUrl, bearer, opts.bytes, post);
      if (p.ok) {
        pendant = "updated";
        notes.push("pendant face updated");
      } else {
        pendant = "failed";
        notes.push(`pendant: ${p.detail}`);
      }
    }
  }

  return { detail: notes.join("; "), telegram, pendant, rev: saved.rev };
}
