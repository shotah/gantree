import { yardDb } from "../door/store";
import {
  googleRedirectForOrigin,
  mintSecret,
  normalizePendantOrigin,
  parseCraneBearers,
  type CraneBearers,
} from "./bearers";
import { putWorkerSecrets, type CloudflarePoster } from "./cloudflare";
import type { PendantSettingsView } from "./shape";

export type { PendantSettingsView } from "./shape";

export const DEFAULT_WORKER_NAME = "gantry-pendant";
export const SETTINGS_POINTER = "Pendant Cloudflare is not configured — Settings → Pendant";

const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const WORKER_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type PendantSettingsRow = {
  apiToken: string;
  accountId: string;
  workerName: string;
  origin: string;
  googleClientId: string;
  googleClientSecret: string;
  sessionSecret: string;
  allowedSubs: string;
  craneBearers: CraneBearers;
  updatedAt: string | null;
};

export type PendantSettingsPatch = {
  apiToken?: string;
  accountId?: string;
  workerName?: string;
  origin?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  rotateSession?: boolean;
  allowedSubs?: string;
};

type DbRow = {
  api_token: string;
  account_id: string;
  worker_name: string;
  origin: string;
  google_client_id: string;
  google_client_secret: string;
  session_secret: string;
  allowed_subs: string;
  crane_bearers: string;
  updated_at: string | null;
};

function emptyRow(): PendantSettingsRow {
  return {
    apiToken: "",
    accountId: "",
    workerName: DEFAULT_WORKER_NAME,
    origin: "",
    googleClientId: "",
    googleClientSecret: "",
    sessionSecret: "",
    allowedSubs: "",
    craneBearers: {},
    updatedAt: null,
  };
}

function fromDb(row: DbRow | undefined): PendantSettingsRow {
  if (!row) {
    return emptyRow();
  }
  return {
    apiToken: row.api_token ?? "",
    accountId: row.account_id ?? "",
    workerName: (row.worker_name ?? "").trim() || DEFAULT_WORKER_NAME,
    origin: row.origin ?? "",
    googleClientId: row.google_client_id ?? "",
    googleClientSecret: row.google_client_secret ?? "",
    sessionSecret: row.session_secret ?? "",
    allowedSubs: row.allowed_subs ?? "",
    craneBearers: parseCraneBearers(row.crane_bearers),
    updatedAt: row.updated_at,
  };
}

export function loadPendantSettings(): PendantSettingsRow {
  const row = yardDb().prepare(
    `SELECT api_token, account_id, worker_name, origin, google_client_id, google_client_secret,
            session_secret, allowed_subs, crane_bearers, updated_at
     FROM pendant_settings WHERE id = 1`,
  ).get() as DbRow | undefined;
  return fromDb(row);
}

export function pendantSettingsView(row: PendantSettingsRow = loadPendantSettings()): PendantSettingsView {
  const origin = normalizePendantOrigin(row.origin) ?? "";
  const token = row.apiToken.trim();
  const accountId = row.accountId.trim();
  const workerName = row.workerName.trim() || DEFAULT_WORKER_NAME;
  const googleId = row.googleClientId.trim();
  return {
    ready: Boolean(token && ACCOUNT_ID.test(accountId) && WORKER_NAME.test(workerName) && origin),
    oauthReady: Boolean(googleId && row.googleClientSecret.trim() && row.sessionSecret.trim()),
    accountId,
    workerName,
    origin,
    googleClientId: googleId,
    allowedSubs: row.allowedSubs.trim(),
    apiTokenSet: Boolean(token),
    googleClientSecretSet: Boolean(row.googleClientSecret.trim()),
    sessionSecretSet: Boolean(row.sessionSecret.trim()),
    craneCount: Object.keys(row.craneBearers).length,
    googleRedirect: googleRedirectForOrigin(origin),
  };
}

export function persistPendantSettings(row: PendantSettingsRow): void {
  const now = new Date().toISOString();
  yardDb().prepare(
    `INSERT INTO pendant_settings (
       id, api_token, account_id, worker_name, origin, google_client_id, google_client_secret,
       session_secret, allowed_subs, crane_bearers, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       api_token = excluded.api_token,
       account_id = excluded.account_id,
       worker_name = excluded.worker_name,
       origin = excluded.origin,
       google_client_id = excluded.google_client_id,
       google_client_secret = excluded.google_client_secret,
       session_secret = excluded.session_secret,
       allowed_subs = excluded.allowed_subs,
       crane_bearers = excluded.crane_bearers,
       updated_at = excluded.updated_at`,
  ).run(
    row.apiToken,
    row.accountId,
    row.workerName.trim() || DEFAULT_WORKER_NAME,
    row.origin,
    row.googleClientId,
    row.googleClientSecret,
    row.sessionSecret,
    row.allowedSubs,
    JSON.stringify(row.craneBearers),
    now,
  );
}

export function persistCraneBearers(map: CraneBearers): PendantSettingsRow {
  const row = loadPendantSettings();
  row.craneBearers = map;
  persistPendantSettings(row);
  return loadPendantSettings();
}

function keepOrSet(current: string, patch: string | undefined): string {
  if (patch === undefined) {
    return current;
  }
  const t = patch.trim();
  if (!t) {
    return current;
  }
  return t;
}

export function applyPendantSettingsPatch(
  current: PendantSettingsRow,
  patch: PendantSettingsPatch,
): { ok: true; row: PendantSettingsRow } | { ok: false; detail: string } {
  const accountId = (patch.accountId ?? current.accountId).trim();
  const workerName = (patch.workerName ?? current.workerName).trim() || DEFAULT_WORKER_NAME;
  const originRaw = patch.origin ?? current.origin;
  const origin = originRaw.trim() ? normalizePendantOrigin(originRaw) : "";
  if (originRaw.trim() && !origin) {
    return { ok: false, detail: "pendant origin must be an https host" };
  }
  if (accountId && !ACCOUNT_ID.test(accountId)) {
    return { ok: false, detail: "Cloudflare account id is 32 hex characters" };
  }
  if (!WORKER_NAME.test(workerName)) {
    return { ok: false, detail: "Worker name looks wrong" };
  }
  const apiToken = keepOrSet(current.apiToken, patch.apiToken);
  const googleClientSecret = keepOrSet(current.googleClientSecret, patch.googleClientSecret);
  let sessionSecret = current.sessionSecret;
  if (patch.rotateSession === true) {
    sessionSecret = mintSecret();
  }
  return {
    ok: true,
    row: {
      ...current,
      apiToken,
      accountId,
      workerName,
      origin: origin || "",
      googleClientId: (patch.googleClientId ?? current.googleClientId).trim(),
      googleClientSecret,
      sessionSecret,
      allowedSubs: patch.allowedSubs !== undefined ? patch.allowedSubs.trim() : current.allowedSubs,
      craneBearers: current.craneBearers,
    },
  };
}

export function parsePendantSettingsPatch(body: unknown): PendantSettingsPatch | { error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: "object required" };
  }
  const rec = body as Record<string, unknown>;
  const patch: PendantSettingsPatch = {};
  const strings = [
    "apiToken",
    "accountId",
    "workerName",
    "origin",
    "googleClientId",
    "googleClientSecret",
    "allowedSubs",
  ] as const;
  for (const k of strings) {
    if (!Object.prototype.hasOwnProperty.call(rec, k)) {
      continue;
    }
    if (typeof rec[k] !== "string") {
      return { error: `${k} must be a string` };
    }
    patch[k] = rec[k];
  }
  if (Object.prototype.hasOwnProperty.call(rec, "rotateSession")) {
    if (rec.rotateSession !== true && rec.rotateSession !== false) {
      return { error: "rotateSession must be a boolean" };
    }
    patch.rotateSession = rec.rotateSession === true;
  }
  return patch;
}

export function cloudflareCreds(
  row: PendantSettingsRow = loadPendantSettings(),
): { ok: true; creds: { token: string; accountId: string; workerName: string } } | { ok: false; detail: string } {
  const token = row.apiToken.trim();
  const accountId = row.accountId.trim();
  const workerName = row.workerName.trim() || DEFAULT_WORKER_NAME;
  if (!token || !ACCOUNT_ID.test(accountId) || !WORKER_NAME.test(workerName)) {
    return { ok: false, detail: SETTINGS_POINTER };
  }
  return { ok: true, creds: { token, accountId, workerName } };
}

export async function savePendantSettings(
  patch: PendantSettingsPatch,
  post?: CloudflarePoster,
): Promise<{ ok: boolean; detail: string; pendant: PendantSettingsView }> {
  const applied = applyPendantSettingsPatch(loadPendantSettings(), patch);
  if (!applied.ok) {
    return { ok: false, detail: applied.detail, pendant: pendantSettingsView() };
  }
  persistPendantSettings(applied.row);
  const row = loadPendantSettings();
  const view = pendantSettingsView(row);
  const googleId = row.googleClientId.trim();
  const googleSecret = row.googleClientSecret.trim();
  if (!googleId && !googleSecret) {
    return { ok: true, detail: "saved Cloudflare settings", pendant: view };
  }
  if (!googleId || !googleSecret) {
    return { ok: false, detail: "Google client id and secret are both required to push OAuth", pendant: view };
  }
  const creds = cloudflareCreds(row);
  if (!creds.ok) {
    return { ok: false, detail: creds.detail, pendant: view };
  }
  if (!row.sessionSecret.trim()) {
    row.sessionSecret = mintSecret();
    persistPendantSettings(row);
  }
  const secrets: Record<string, string> = {
    GOOGLE_CLIENT_ID: googleId,
    GOOGLE_CLIENT_SECRET: googleSecret,
    SESSION_SECRET: row.sessionSecret,
  };
  if (row.allowedSubs.trim()) {
    secrets.ALLOWED_SUBS = row.allowedSubs.trim();
  }
  const put = await putWorkerSecrets(creds.creds, secrets, post);
  if (!put.ok) {
    return { ok: false, detail: put.detail, pendant: pendantSettingsView() };
  }
  return { ok: true, detail: put.detail, pendant: pendantSettingsView() };
}
