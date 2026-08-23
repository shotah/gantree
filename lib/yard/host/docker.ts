import { statSync, type Stats } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import Dockerode from "dockerode";
import { yardRoot } from "./files";
import { decodeDockerLogs } from "./logs";
import type { GantryState } from "../types";

let client: Dockerode | null = null;

export function docker(): Dockerode {
  if (!client) {
    client = new Dockerode({ socketPath: process.env.DOCKER_HOST?.startsWith("unix://")
      ? process.env.DOCKER_HOST.slice("unix://".length)
      : process.env.DOCKER_SOCKET || "/var/run/docker.sock" });
  }
  return client;
}

export function dockerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("EACCES") || msg.includes("permission denied")) {
    return "Cannot talk to Docker (permission denied). Add this user to the docker group, or set DOCKER_SOCKET.";
  }
  if (msg.includes("ENOENT")) {
    return "Docker socket not found. Is Docker running?";
  }
  return msg;
}

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
  const hostRoot = process.env.GANTREE_HOST_ROOT?.trim();
  if (!hostRoot || !containerPath) {
    return containerPath;
  }
  const root = yardRoot();
  const hostPrefix = hostRoot.endsWith(sep) ? hostRoot : `${hostRoot}${sep}`;
  if (containerPath === hostRoot || containerPath.startsWith(hostPrefix)) {
    return containerPath;
  }
  const rel = relative(root, containerPath);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return containerPath;
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

export type ListedContainer = {
  id: string;
  name: string;
  image: string;
  state: GantryState;
  status: string;
  labels: Record<string, string>;
};

export async function listGantryContainers(): Promise<ListedContainer[]> {
  const all = await docker().listContainers({ all: true });
  const out: ListedContainer[] = [];
  for (const c of all) {
    const names = (c.Names ?? []).map(normalizeName);
    const image = c.Image ?? "";
    const labelSlug = c.Labels?.["gantree.slug"];
    if (!labelSlug && !looksLikeGantry(image, names)) {
      continue;
    }
    out.push({
      id: c.Id,
      name: labelSlug || names[0] || c.Id.slice(0, 12),
      image,
      state: stateOf(c.State),
      status: c.Status ?? "",
      labels: c.Labels ?? {},
    });
  }
  return out;
}

export async function inspectByName(name: string) {
  const list = await docker().listContainers({ all: true });
  const hit = list.find((c) => (c.Names ?? []).map(normalizeName).includes(name) || c.Id.startsWith(name));
  if (!hit) {
    return null;
  }
  const info = await docker().getContainer(hit.Id).inspect();
  return { listed: hit, info };
}

export async function containerLogsBuffer(id: string, tail: number): Promise<Buffer> {
  const buf = await docker().getContainer(id).logs({
    stdout: true,
    stderr: true,
    timestamps: true,
    tail,
    follow: false,
  });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf));
}

export async function containerLogsFollow(id: string, tail: number): Promise<NodeJS.ReadableStream> {
  return docker().getContainer(id).logs({
    stdout: true,
    stderr: true,
    timestamps: true,
    tail,
    follow: true,
  });
}

export async function pullImage(image: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    docker().pull(image, (err: Error | null, stream?: NodeJS.ReadableStream) => {
      if (err || !stream) {
        reject(err ?? new Error(`pull ${image} failed`));
        return;
      }
      docker().modem.followProgress(stream, (doneErr) => (doneErr ? reject(doneErr) : resolve()));
    });
  });
}

export async function containerStatsOnce(id: string) {
  return docker().getContainer(id).stats({ stream: false });
}

export async function execGantry(
  id: string,
  args: string[],
): Promise<{ text: string; exitCode: number } | null> {
  try {
    const exec = await docker().getContainer(id).exec({
      Cmd: ["/usr/local/bin/gantry", ...args],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (d: Buffer) => chunks.push(d));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const info = await exec.inspect();
    const text = decodeDockerLogs(Buffer.concat(chunks)).trim();
    return { text, exitCode: info.ExitCode ?? 0 };
  } catch {
    return null;
  }
}

export async function execStatus(id: string): Promise<string | null> {
  const result = await execGantry(id, ["status"]);
  return result?.text || null;
}

export type CpuMem = { cpuPercent: number | null; memBytes: number | null; memLimitBytes: number | null };

export function cpuMemFromStats(stats: {
  cpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number; online_cpus?: number };
  precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number };
  memory_stats?: { usage?: number; limit?: number };
}): CpuMem {
  const memBytes = stats.memory_stats?.usage ?? null;
  const memLimitBytes = stats.memory_stats?.limit ?? null;
  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const sysDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const ncpu = stats.cpu_stats?.online_cpus ?? 1;
  let cpuPercent: number | null = null;
  if (sysDelta > 0 && cpuDelta >= 0) {
    cpuPercent = (cpuDelta / sysDelta) * ncpu * 100;
  }
  return { cpuPercent, memBytes, memLimitBytes };
}
