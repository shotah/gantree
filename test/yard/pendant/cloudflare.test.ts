import { describe, expect, it } from "vitest";
import {
  defaultCloudflarePost,
  putWorkerSecret,
  putWorkerSecrets,
  redactSecrets,
  type CloudflarePoster,
} from "@/lib/yard/pendant/cloudflare";

const creds = {
  token: "cf-token-abcdefghijklmnopqrstuvwxyz",
  accountId: "0123456789abcdef0123456789abcdef",
  workerName: "gantry-pendant",
};

function poster(
  impl: (url: string, init: RequestInit) => { status: number; body: string } | Promise<{ status: number; body: string }>,
): CloudflarePoster {
  return async (url, init) => impl(url, init);
}

describe("redactSecrets", () => {
  it("strips long values and caps length", () => {
    expect(redactSecrets("token cf-token-abcdefghijklmnopqrstuvwxyz leaked", [creds.token])).toBe(
      "token *** leaked",
    );
    expect(redactSecrets("short", ["abcd"])).toBe("short");
  });
});

describe("putWorkerSecret", () => {
  it("PUTs secret_text and never echoes the value", async () => {
    const calls: { url: string; auth: string; body: string }[] = [];
    const post = poster((url, init) => {
      calls.push({
        url,
        auth: String((init.headers as Record<string, string>).Authorization),
        body: String(init.body),
      });
      return { status: 200, body: JSON.stringify({ success: true, result: { name: "SESSION_SECRET", type: "secret_text" } }) };
    });
    const out = await putWorkerSecret(creds, "SESSION_SECRET", "super-secret-value-here", post);
    expect(out).toEqual({ ok: true, detail: "put SESSION_SECRET" });
    expect(calls[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/workers/scripts/gantry-pendant/secrets",
    );
    expect(calls[0]?.auth).toBe(`Bearer ${creds.token}`);
    expect(JSON.parse(calls[0]!.body)).toEqual({
      name: "SESSION_SECRET",
      text: "super-secret-value-here",
      type: "secret_text",
    });
  });

  it("maps 403 to a token-refused detail without the token", async () => {
    const post = poster(() => ({
      status: 403,
      body: JSON.stringify({ success: false, errors: [{ message: `auth ${creds.token}` }] }),
    }));
    const out = await putWorkerSecret(creds, "X", "secret-value-long-enough", post);
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/refused/);
    expect(out.detail).not.toContain(creds.token);
  });

  it("maps missing Worker to a CI pointer", async () => {
    const post = poster(() => ({
      status: 404,
      body: JSON.stringify({ success: false, errors: [{ code: 10007, message: "workers.api.error.script_not_found" }] }),
    }));
    const out = await putWorkerSecret(creds, "X", "secret-value-long-enough", post);
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/gantry-pendant CI/);
  });
});

describe("putWorkerSecrets", () => {
  it("stops on the first failure and names the secret", async () => {
    let n = 0;
    const post = poster(() => {
      n += 1;
      if (n === 1) {
        return { status: 200, body: JSON.stringify({ success: true, result: { name: "A", type: "secret_text" } }) };
      }
      return { status: 500, body: JSON.stringify({ success: false, errors: [{ message: "boom" }] }) };
    });
    const out = await putWorkerSecrets(creds, { A: "aaaaaaaa", B: "bbbbbbbb" }, post);
    expect(out.ok).toBe(false);
    expect(out.detail).toBe("B: boom");
    expect(n).toBe(2);
  });
});

describe("defaultCloudflarePost", () => {
  it("is the fetch adapter", () => {
    expect(typeof defaultCloudflarePost).toBe("function");
  });
});
