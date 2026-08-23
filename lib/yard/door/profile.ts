import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { acceptJpeg, findAvatar, saveAvatar } from "../host/avatar";
import { dbPath } from "./store";

export function operatorAvatarDir(id: string): string {
  return resolve(dirname(dbPath()), "operators", id);
}

export function operatorAvatarRev(id: string): number | null {
  return findAvatar(operatorAvatarDir(id))?.rev ?? null;
}

export function saveOperatorAvatar(id: string, bytes: Uint8Array): { ok: true; rev: number } | { ok: false; error: string } {
  const check = acceptJpeg(bytes);
  if (!check.ok) {
    return { ok: false, error: check.detail };
  }
  const hit = saveAvatar(operatorAvatarDir(id), bytes);
  return { ok: true, rev: hit.rev };
}

export function readOperatorAvatar(id: string): { path: string; type: string; rev: number } | null {
  const hit = findAvatar(operatorAvatarDir(id));
  if (!hit) {
    return null;
  }
  return { path: hit.path, type: hit.type, rev: hit.rev };
}

export function removeOperatorAvatar(id: string): void {
  rmSync(operatorAvatarDir(id), { recursive: true, force: true });
}
