import { loadEnvFile, mergeEnv, writeEnvFile } from "../host/envfile";
import { getGantry } from "../crane/inventory";
import { shouldPushPendant } from "../crane/pendantShape";
import {
  dropCraneBearer,
  formatCraneBearers,
  mailboxUrlForSlug,
  mergeCraneBearer,
  mintBearer,
} from "./bearers";
import { putWorkerSecrets, type CloudflarePoster } from "./cloudflare";
import {
  SETTINGS_POINTER,
  cloudflareCreds,
  loadPendantSettings,
  persistCraneBearers,
  pendantSettingsView,
} from "./settings";

export type PendantEnv = {
  CHANNEL: string;
  PENDANT_MAILBOX_URL: string;
  PENDANT_BEARER: string;
  PENDANT_ALLOWED_USERS: string;
};

async function putCraneBearers(
  map: Record<string, string>,
  post?: CloudflarePoster,
): Promise<{ ok: boolean; detail: string }> {
  const creds = cloudflareCreds();
  if (!creds.ok) {
    return creds;
  }
  return putWorkerSecrets(creds.creds, { CRANE_BEARERS: formatCraneBearers(map) }, post);
}

export function pendantChannelReady(): { ok: true } | { ok: false; detail: string } {
  const view = pendantSettingsView();
  if (!view.ready) {
    return { ok: false, detail: SETTINGS_POINTER };
  }
  return { ok: true };
}

export async function provisionPendantCrane(
  slug: string,
  allowlist: string,
  opts?: { post?: CloudflarePoster; mint?: () => string },
): Promise<{ ok: true; env: PendantEnv } | { ok: false; detail: string }> {
  const ready = pendantChannelReady();
  if (!ready.ok) {
    return ready;
  }
  const row = loadPendantSettings();
  const mailbox = mailboxUrlForSlug(row.origin, slug);
  if (!mailbox) {
    return { ok: false, detail: SETTINGS_POINTER };
  }
  const bearer = (opts?.mint ?? mintBearer)();
  const next = mergeCraneBearer(row.craneBearers, slug, bearer);
  const put = await putCraneBearers(next, opts?.post);
  if (!put.ok) {
    return { ok: false, detail: put.detail };
  }
  persistCraneBearers(next);
  return {
    ok: true,
    env: {
      CHANNEL: "pendant",
      PENDANT_MAILBOX_URL: mailbox,
      PENDANT_BEARER: bearer,
      PENDANT_ALLOWED_USERS: allowlist,
    },
  };
}

export async function rotatePendantBearer(
  slug: string,
  opts?: { post?: CloudflarePoster; mint?: () => string },
): Promise<{ ok: boolean; detail: string }> {
  const g = await getGantry(slug);
  if (!g) {
    return { ok: false, detail: "not found" };
  }
  if (!g.envFile) {
    return { ok: false, detail: "no env_file" };
  }
  const file = loadEnvFile(g.envFile);
  if (!shouldPushPendant(file.CHANNEL || g.channel)) {
    return { ok: false, detail: "not pendant" };
  }
  const provisioned = await provisionPendantCrane(slug, file.PENDANT_ALLOWED_USERS ?? "", opts);
  if (!provisioned.ok) {
    return provisioned;
  }
  writeEnvFile(g.envFile, mergeEnv(file, provisioned.env));
  return {
    ok: true,
    detail: "rotated bearer — recreate to apply (do not just restart)",
  };
}

export async function dropPendantBearer(
  slug: string,
  opts?: { post?: CloudflarePoster },
): Promise<{ ok: boolean; pushed: boolean; detail: string }> {
  const row = loadPendantSettings();
  if (!Object.prototype.hasOwnProperty.call(row.craneBearers, slug)) {
    return { ok: true, pushed: false, detail: "no pendant bearer for slug" };
  }
  const next = dropCraneBearer(row.craneBearers, slug);
  persistCraneBearers(next);
  const creds = cloudflareCreds();
  if (!creds.ok) {
    return { ok: true, pushed: false, detail: creds.detail };
  }
  const put = await putCraneBearers(next, opts?.post);
  if (!put.ok) {
    return { ok: false, pushed: false, detail: put.detail };
  }
  return { ok: true, pushed: true, detail: `dropped ${slug} from CRANE_BEARERS` };
}
