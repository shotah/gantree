import { cmpGantryVersion } from "../crane/status";
import { DEFAULT_IMAGE } from "../types";

const EXACT_SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;
const HUB_TAGS = "https://hub.docker.com/v2/repositories";
const HUB_PAGE_SIZE = 100;
const HUB_MAX_PAGES = 10;
const HUB_CACHE_MS = 60_000;

export type ImageRef = { name: string; tag: string };

export type HubGet = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

type HubTagsPage = {
  next?: string | null;
  results?: Array<{ name?: unknown }>;
};

const hubTagCache = new Map<string, { at: number; tags: string[] }>();

export function resetHubTagCache(): void {
  hubTagCache.clear();
}

export function parseImageRef(image: string): ImageRef {
  const raw = image.trim();
  if (!raw || raw.includes("@")) {
    return { name: raw, tag: "" };
  }
  const colon = raw.lastIndexOf(":");
  const slash = raw.lastIndexOf("/");
  if (colon > slash && colon !== -1) {
    return { name: raw.slice(0, colon), tag: raw.slice(colon + 1) };
  }
  return { name: raw, tag: "latest" };
}

export function isMovingImageTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  return t === "latest" || t === "edge";
}

export function isExactSemverTag(tag: string): boolean {
  return EXACT_SEMVER.test(tag.trim());
}

/** Docker Hub `namespace/name` — not GHCR, localhost, or official library images. */
export function isDockerHubRepo(name: string): boolean {
  if (!name || name.includes("://") || name.includes("@")) {
    return false;
  }
  const parts = name.split("/");
  if (parts.length !== 2) {
    return false;
  }
  const [ns, repo] = parts;
  if (!ns || !repo || ns.includes(".") || ns.includes(":") || ns === "localhost") {
    return false;
  }
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(ns) && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(repo);
}

/** Newest `X.Y.Z` (optional `v`) — ignores `latest`, `edge`, `1.1`, `sha-*`. */
export function newestHubSemver(tags: string[]): string | null {
  const found = tags.filter((t) => isExactSemverTag(t));
  if (found.length === 0) {
    return null;
  }
  return found.reduce((best, t) => (cmpGantryVersion(t, best) > 0 ? t : best));
}

/** Board catch-up: pull this repo's floating `:latest` (resolved to Hub semver). */
export function catchUpPin(image: string | null | undefined, fallback = DEFAULT_IMAGE): string {
  const raw = (image ?? "").trim() || fallback;
  const { name } = parseImageRef(raw);
  if (isDockerHubRepo(name)) {
    return `${name}:latest`;
  }
  return raw;
}

export async function listHubTags(repo: string, get: HubGet = hubGet, now = Date.now): Promise<string[]> {
  const cached = hubTagCache.get(repo);
  const at = now();
  if (cached && at - cached.at < HUB_CACHE_MS) {
    return cached.tags;
  }
  const [ns, name] = repo.split("/");
  if (!ns || !name) {
    throw new Error(`not a Docker Hub repo: ${repo}`);
  }
  const tags: string[] = [];
  let url: string | null
    = `${HUB_TAGS}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}/tags?page_size=${HUB_PAGE_SIZE}`;
  for (let page = 0; url && page < HUB_MAX_PAGES; page++) {
    const res = await get(url);
    if (!res.ok) {
      throw new Error(`Docker Hub tags ${res.status} for ${repo}`);
    }
    const body: unknown = await res.json();
    const parsed = parseHubTagsPage(body);
    tags.push(...parsed.names);
    url = parsed.next;
  }
  hubTagCache.set(repo, { at, tags });
  return tags;
}

/** Moving Hub tags (`latest` / `edge`) become the newest `X.Y.Z` on Docker Hub. */
export async function resolveHubImage(image: string, get: HubGet = hubGet): Promise<string> {
  const pin = image.trim();
  const ref = parseImageRef(pin);
  if (!isDockerHubRepo(ref.name) || !isMovingImageTag(ref.tag)) {
    return pin;
  }
  const newest = newestHubSemver(await listHubTags(ref.name, get));
  if (!newest) {
    throw new Error(`Docker Hub has no semver tags for ${ref.name}`);
  }
  return `${ref.name}:${newest}`;
}

export async function pullResolvedImage(
  image: string,
  io: {
    pull: (image: string) => Promise<void>;
    tag: (source: string, dest: string) => Promise<void>;
    resolve?: (image: string) => Promise<string>;
  },
): Promise<void> {
  const pin = image.trim();
  const resolved = await (io.resolve ?? resolveHubImage)(pin);
  await io.pull(resolved);
  if (resolved !== pin) {
    await io.tag(resolved, pin);
  }
}

async function hubGet(url: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  return { ok: res.ok, status: res.status, json: () => res.json() as Promise<unknown> };
}

function parseHubTagsPage(body: unknown): { names: string[]; next: string | null } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Docker Hub tags: unexpected body");
  }
  const page = body as HubTagsPage;
  const names = (page.results ?? [])
    .map((row) => (typeof row.name === "string" ? row.name.trim() : ""))
    .filter(Boolean);
  const next = typeof page.next === "string" && page.next.trim() ? page.next.trim() : null;
  return { names, next };
}
