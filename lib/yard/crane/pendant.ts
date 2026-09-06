import { inspectByName } from "../host/docker";
import { loadEnvFile, mergeEnv, writeEnvFile } from "../host/envfile";
import { envListValue, seenUsers } from "../host/telegram";
import { peekTurns, sampleTurns } from "../observe/stats";
import { suggestStoreGoogleSub } from "../observe/spend";
import { listOperators } from "../door/operators";
import { getGantry } from "./inventory";
import type { GantryCard } from "../types";
import {
  formatPendantAllowlist,
  formatPendantEntry,
  parsePendantAllowlist,
  shouldPushPendant,
  type PendantAllowEntry,
  type PendantSnapshot,
} from "./pendantShape";

export type { PendantAllowEntry, PendantSnapshot } from "./pendantShape";
export {
  formatPendantAllowlist,
  formatPendantEntry,
  operatorOnPendantList,
  parsePendantAllowlist,
  parsePendantEntry,
  pendantEntryForOperator,
  shouldPushPendant,
} from "./pendantShape";

export async function cranePendantAuth(g: GantryCard): Promise<{
  channel: string | null;
  mailboxUrl: string | null;
  bearerSet: boolean;
  allowlist: PendantAllowEntry[];
}> {
  const file = loadEnvFile(g.envFile);
  let inspectEnv: string[] | null = null;
  const haveChannel = Boolean((g.channel || file.CHANNEL || "").trim());
  const haveMailbox = Boolean((file.PENDANT_MAILBOX_URL || "").trim());
  const haveBearer = Boolean((file.PENDANT_BEARER || "").trim());
  if (!haveChannel || !haveMailbox || !haveBearer) {
    try {
      const inspected = await inspectByName(g.containerId || g.containerName);
      inspectEnv = inspected?.info.Config.Env ?? null;
    } catch {
      inspectEnv = null;
    }
  }
  const channel
    = g.channel?.trim() || file.CHANNEL?.trim() || envListValue(inspectEnv, "CHANNEL") || null;
  const mailboxUrl
    = file.PENDANT_MAILBOX_URL?.trim() || envListValue(inspectEnv, "PENDANT_MAILBOX_URL") || null;
  const bearer = file.PENDANT_BEARER?.trim() || envListValue(inspectEnv, "PENDANT_BEARER") || "";
  const allowRaw = file.PENDANT_ALLOWED_USERS || envListValue(inspectEnv, "PENDANT_ALLOWED_USERS");
  return {
    channel,
    mailboxUrl,
    bearerSet: Boolean(bearer),
    allowlist: parsePendantAllowlist(allowRaw),
  };
}

function emptyPendantSnapshot(over: Partial<PendantSnapshot> & Pick<PendantSnapshot, "detail">): PendantSnapshot {
  return {
    enabled: false,
    mailboxUrl: null,
    bearerSet: false,
    allowlist: [],
    seen: [],
    suggestion: null,
    ...over,
  };
}

export async function pendantSnapshot(slug: string): Promise<PendantSnapshot | null> {
  const g = await getGantry(slug);
  if (!g) {
    return null;
  }
  await sampleTurns(slug).catch(() => []);
  const seen = seenUsers(peekTurns(slug));
  const auth = await cranePendantAuth(g);
  const allowlist = auth.allowlist.map(formatPendantEntry);
  if (!shouldPushPendant(auth.channel)) {
    return emptyPendantSnapshot({ seen, allowlist, detail: "not pendant" });
  }
  const operators = listOperators();
  const suggestion = suggestStoreGoogleSub(
    seen.map((s) => s.id),
    auth.allowlist,
    operators,
  );
  return {
    enabled: true,
    mailboxUrl: auth.mailboxUrl,
    bearerSet: auth.bearerSet,
    allowlist,
    seen,
    suggestion,
    detail: auth.bearerSet ? "pendant" : "no PENDANT_BEARER",
  };
}

export async function saveGantryPendantAllowlist(
  slug: string,
  entries: string[],
): Promise<{ ok: boolean; detail: string; allowlist: string[] }> {
  const g = await getGantry(slug);
  if (!g) {
    return { ok: false, detail: "not found", allowlist: [] };
  }
  if (!g.envFile) {
    return { ok: false, detail: "no env_file", allowlist: [] };
  }
  const auth = await cranePendantAuth(g);
  if (!shouldPushPendant(auth.channel)) {
    return { ok: false, detail: "not pendant", allowlist: [] };
  }
  const allowlist = parsePendantAllowlist(entries);
  const formatted = allowlist.map(formatPendantEntry);
  writeEnvFile(g.envFile, mergeEnv(loadEnvFile(g.envFile), { PENDANT_ALLOWED_USERS: formatPendantAllowlist(allowlist) }));
  return {
    ok: true,
    detail: `allowlist ${formatted.length} ${formatted.length === 1 ? "entry" : "entries"} — recreate to apply (do not just restart)`,
    allowlist: formatted,
  };
}
