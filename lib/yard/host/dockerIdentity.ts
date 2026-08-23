import { statSync, type Stats } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { yardRoot } from "./files";
import type { GantryState, HostRole } from "../types";

export function normalizeName(name: string): string {
  return name.replace(/^\//, "");
}

export function stateOf(raw: string | undefined, flags?: { running?: boolean; paused?: boolean }): GantryState {
  if (flags?.paused) {
    return "paused";
  }
  // docker restart leaves Status=restarting while Running is already true
  if (flags?.running) {
    return "running";
  }
  switch (raw) {
    case "running":
    case "exited":
    case "created":
    case "paused":
    case "restarting":
    case "dead":
      return raw;
    default:
      return "unknown";
  }
}

const DISTROLESS_USER = /^(65532|65532:65532|nonroot)$/i;
const NOBODY_UIDS = new Set([0, 65532, 65534]);

type UidGid = Pick<Stats, "uid" | "gid">;

/** A login uid:gid — not root, Distroless nonroot, or nobody. */
export function usableUserSpec(raw: string | undefined | null): string | undefined {
  const kept = (raw ?? "").trim();
  if (!kept || DISTROLESS_USER.test(kept) || kept === "root") {
    return undefined;
  }
  const m = kept.match(/^(\d+)(?::(\d+))?$/);
  if (!m) {
    return kept;
  }
  const uid = Number(m[1]);
  const gid = m[2] != null ? Number(m[2]) : uid;
  if (NOBODY_UIDS.has(uid) || gid === 65532 || gid === 65534) {
    return undefined;
  }
  return m[2] != null ? `${uid}:${gid}` : kept;
}

export function ownerUserSpec(
  paths: (string | null | undefined)[],
  stat: (p: string) => UidGid = (p) => statSync(p),
): string | undefined {
  for (const p of paths) {
    if (!p) {
      continue;
    }
    try {
      const st = stat(p);
      const spec = usableUserSpec(`${st.uid}:${st.gid}`);
      if (spec) {
        return spec;
      }
    } catch {
      /* missing path */
    }
  }
  return undefined;
}

/**
 * uid:gid for cranes. Prefer the owner of data/ (and inventory files), then
 * GANTREE_CRANE_USER, then this process when it is not root. Compose fills
 * GANTREE_CRANE_USER from the host shell UID — no `id -u` required.
 */
export function hostUserSpec(...paths: (string | null | undefined)[]): string | undefined {
  const fromFiles = ownerUserSpec(paths);
  if (fromFiles) {
    return fromFiles;
  }
  const env = usableUserSpec(process.env.GANTREE_CRANE_USER);
  if (env) {
    return env;
  }
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return undefined;
  }
  return usableUserSpec(`${process.getuid()}:${process.getgid()}`);
}

/** Keep a real host user from inspect. Drop image-default nonroot (that cannot write host-owned data/). */
export function craneUser(existing?: string | null, ...paths: (string | null | undefined)[]): string | undefined {
  return usableUserSpec(existing) ?? hostUserSpec(...paths);
}

/** Dest path inside the container (`src:dest` or `src:dest:mode`). */
export function bindDest(bind: string): string {
  const parts = bind.split(":");
  return parts.length >= 2 ? parts[1] : bind;
}

/**
 * Docker bind sources are host paths. Console-in-Docker resolves inventory
 * under /app; rewrite those to GANTREE_HOST_ROOT (the checkout on the host).
 * Absolute attach paths (/opt/agents/…) stay as-is — same-path mount those.
 */
export function hostBindPath(containerPath: string): string {
  if (!containerPath) {
    return containerPath;
  }
  const root = yardRoot();
  const fromConsole = isAbsolute(containerPath) ? containerPath : resolve(root, containerPath);
  const hostRoot = process.env.GANTREE_HOST_ROOT?.trim();
  if (!hostRoot) {
    return fromConsole;
  }
  const hostPrefix = hostRoot.endsWith(sep) ? hostRoot : `${hostRoot}${sep}`;
  if (fromConsole === hostRoot || fromConsole.startsWith(hostPrefix)) {
    return fromConsole;
  }
  const rel = relative(root, fromConsole);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return fromConsole;
  }
  return resolve(hostRoot, rel);
}

export function mergeBinds(required: string[], existing?: string[] | null): string[] {
  const seen = new Set(required.map(bindDest));
  const extra = (existing ?? []).filter((b) => !seen.has(bindDest(b)));
  return [...required, ...extra];
}

const DEFAULT_CRANE_PATH = "/usr/local/bin:/usr/bin:/bin";

function envValue(env: string[] | null | undefined, key: string): string | undefined {
  const prefix = `${key}=`;
  const hit = (env ?? []).find((e) => e.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined;
}

/**
 * MCP bins live in /data/bin (tools-fetch) and sometimes /tools (fleet compose).
 * Recreate must keep the old PATH (and /tools when that bind survives) instead of
 * replacing it with a distroless default that drops /tools.
 */
export function cranePath(opts: {
  envPath?: string;
  existingEnv?: string[] | null;
  binds: string[];
}): string {
  const parts = (opts.envPath?.trim() || envValue(opts.existingEnv, "PATH") || DEFAULT_CRANE_PATH)
    .split(":")
    .map((p) => p.trim())
    .filter((p) => p && p !== "/data/bin");
  if (opts.binds.some((b) => bindDest(b) === "/tools") && !parts.includes("/tools")) {
    parts.push("/tools");
  }
  parts.unshift("/data/bin");
  return parts.join(":");
}

export type CraneRuntime = {
  user?: string;
  networkMode?: string;
  binds: string[];
  groupAdd?: string[];
  labels: Record<string, string>;
};

export function craneRuntime(
  info?: {
    Config?: { User?: string; Labels?: Record<string, string> | null };
    HostConfig?: { NetworkMode?: string; Binds?: string[] | null; GroupAdd?: string[] | null };
  },
  ownerPaths?: (string | null | undefined)[],
): CraneRuntime {
  const networkMode = info?.HostConfig?.NetworkMode?.trim();
  const groupAdd = (info?.HostConfig?.GroupAdd ?? []).filter((g) => Boolean(g));
  return {
    user: craneUser(info?.Config?.User, ...(ownerPaths ?? [])),
    networkMode: networkMode && networkMode !== "default" ? networkMode : undefined,
    binds: info?.HostConfig?.Binds ?? [],
    groupAdd: groupAdd.length ? groupAdd : undefined,
    labels: { ...(info?.Config?.Labels ?? {}) },
  };
}

export function looksLikeGantry(image: string, names: string[]): boolean {
  const n = names.map(normalizeName).join(" ");
  if (/\bgantree\b/.test(image) || /\bgantree\b/.test(n)) {
    return false;
  }
  return /ai-gantry|\/gantry:|(^|[\s/])gantry/.test(`${image} ${n}`);
}

/** The console image (shotah/gantree), not cloudflared or a crane. */
export function looksLikeConsole(image: string, names: string[]): boolean {
  const blob = `${image} ${names.map(normalizeName).join(" ")}`.toLowerCase();
  if (blob.includes("cloudflared")) {
    return false;
  }
  return /\bgantree\b/.test(blob);
}

export function workloadRole(opts: { name: string; image: string; craneNames: Iterable<string> }): HostRole {
  const want = new Set([...opts.craneNames].map(normalizeName));
  if (want.has(normalizeName(opts.name))) {
    return "crane";
  }
  if (looksLikeConsole(opts.image, [opts.name])) {
    return "console";
  }
  if (looksLikeGantry(opts.image, [opts.name])) {
    return "crane";
  }
  return "other";
}

export function pickConsoleWorkload<T extends { name: string; image: string; running: boolean }>(rows: T[]): T | null {
  const hits = rows.filter((r) => looksLikeConsole(r.image, [r.name]));
  return hits.find((h) => h.running) ?? hits[0] ?? null;
}
