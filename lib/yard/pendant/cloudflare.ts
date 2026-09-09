const CF_API = "https://api.cloudflare.com/client/v4";
const PUT_TIMEOUT_MS = 20_000;

export type CloudflareCreds = {
  token: string;
  accountId: string;
  workerName: string;
};

export type CloudflarePoster = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; body: string }>;

export async function defaultCloudflarePost(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
}

export function redactSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s.length >= 8) {
      out = out.split(s).join("***");
    }
  }
  return out.slice(0, 240);
}

function cfMessage(body: string): string {
  try {
    const j = JSON.parse(body) as {
      errors?: { code?: number; message?: string }[];
      messages?: { message?: string }[];
    };
    const err = j.errors?.find((e) => typeof e.message === "string" && e.message.trim());
    if (err?.message) {
      if (err.code === 10007 || /script not found/i.test(err.message)) {
        return "Worker not found — deploy gantry-pendant CI first, then save again";
      }
      return err.message.trim();
    }
    const msg = j.messages?.find((m) => typeof m.message === "string" && m.message.trim());
    if (msg?.message) {
      return msg.message.trim();
    }
  } catch {
    /* keep raw */
  }
  const t = body.trim();
  return t || "empty Cloudflare response";
}

function secretUrl(creds: CloudflareCreds): string {
  return `${CF_API}/accounts/${encodeURIComponent(creds.accountId)}/workers/scripts/${encodeURIComponent(creds.workerName)}/secrets`;
}

export async function putWorkerSecret(
  creds: CloudflareCreds,
  name: string,
  text: string,
  post: CloudflarePoster = defaultCloudflarePost,
): Promise<{ ok: boolean; detail: string }> {
  const token = creds.token.trim();
  if (!token) {
    return { ok: false, detail: "Cloudflare API token missing" };
  }
  if (!creds.accountId.trim() || !creds.workerName.trim()) {
    return { ok: false, detail: "Cloudflare account id and Worker name required" };
  }
  if (!name.trim()) {
    return { ok: false, detail: "secret name required" };
  }
  try {
    const res = await post(secretUrl(creds), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, text, type: "secret_text" }),
      signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
    });
    const detail = redactSecrets(cfMessage(res.body), [token, text]);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail: "Cloudflare token was refused (need Edit Cloudflare Workers)" };
    }
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, detail };
    }
    try {
      const j = JSON.parse(res.body) as { success?: boolean };
      if (j.success === false) {
        return { ok: false, detail };
      }
    } catch {
      return { ok: false, detail };
    }
    return { ok: true, detail: `put ${name}` };
  } catch (err) {
    return {
      ok: false,
      detail: redactSecrets(err instanceof Error ? err.message : String(err), [token, text]),
    };
  }
}

export async function putWorkerSecrets(
  creds: CloudflareCreds,
  secrets: Record<string, string>,
  post: CloudflarePoster = defaultCloudflarePost,
): Promise<{ ok: boolean; detail: string }> {
  const names = Object.keys(secrets);
  if (names.length === 0) {
    return { ok: true, detail: "nothing to put" };
  }
  for (const name of names) {
    const one = await putWorkerSecret(creds, name, secrets[name] ?? "", post);
    if (!one.ok) {
      return { ok: false, detail: `${name}: ${one.detail}` };
    }
  }
  return {
    ok: true,
    detail: `put ${names.length} Worker secret${names.length === 1 ? "" : "s"}`,
  };
}
