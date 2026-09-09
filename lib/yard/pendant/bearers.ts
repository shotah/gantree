import { randomBytes } from "node:crypto";
import { slugOk } from "../crane/slug";

export type CraneBearers = Record<string, string>;

export function mintSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function mintBearer(): string {
  return mintSecret();
}

export function parseCraneBearers(raw: string | null | undefined): CraneBearers {
  const t = (raw ?? "").trim();
  if (!t) {
    return {};
  }
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as unknown;
      if (j && typeof j === "object" && !Array.isArray(j)) {
        const out: CraneBearers = {};
        for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
          if (slugOk(k) && typeof v === "string" && v.trim()) {
            out[k] = v.trim();
          }
        }
        return out;
      }
    } catch {
      /* fall through to slug:token */
    }
  }
  const out: CraneBearers = {};
  for (const part of t.split(/[,\s]+/)) {
    const p = part.trim();
    if (!p) {
      continue;
    }
    const colon = p.indexOf(":");
    if (colon < 1) {
      continue;
    }
    const slug = p.slice(0, colon).trim();
    const token = p.slice(colon + 1).trim();
    if (slugOk(slug) && token) {
      out[slug] = token;
    }
  }
  return out;
}

export function formatCraneBearers(map: CraneBearers): string {
  return Object.keys(map)
    .filter((slug) => slugOk(slug) && (map[slug] ?? "").trim())
    .sort()
    .map((slug) => `${slug}:${map[slug]!.trim()}`)
    .join(",");
}

export function mergeCraneBearer(map: CraneBearers, slug: string, bearer: string): CraneBearers {
  if (!slugOk(slug) || !bearer.trim()) {
    return { ...map };
  }
  return { ...map, [slug]: bearer.trim() };
}

export function dropCraneBearer(map: CraneBearers, slug: string): CraneBearers {
  const next = { ...map };
  delete next[slug];
  return next;
}

export function normalizePendantOrigin(raw: string): string | null {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (!url.hostname) {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "wss:" && url.protocol !== "ws:") {
    return null;
  }
  const https = url.protocol === "https:" || url.protocol === "wss:";
  return `${https ? "https" : "http"}://${url.host}`;
}

export function mailboxUrlForSlug(origin: string, slug: string): string | null {
  const httpsOrigin = normalizePendantOrigin(origin);
  if (!httpsOrigin || !slugOk(slug)) {
    return null;
  }
  const u = new URL(httpsOrigin);
  const proto = u.protocol === "http:" ? "ws:" : "wss:";
  return `${proto}//${u.host}/ws/${slug}`;
}

export function googleRedirectForOrigin(origin: string): string | null {
  const httpsOrigin = normalizePendantOrigin(origin);
  if (!httpsOrigin) {
    return null;
  }
  return `${httpsOrigin}/api/auth/callback/google`;
}
