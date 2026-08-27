import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import Dockerode from "dockerode";
import { decodeDockerLogs } from "./logs";
import { looksLikeGantry, normalizeName, pickConsoleWorkload, stateOf } from "./dockerIdentity";
import { shotDockerEnabled } from "./shotMode";
import {
  shotContainerStats,
  shotFindConsoleWorkload,
  shotHostInfo,
  shotInspect,
  shotListGantryContainers,
  shotListRunningWorkloads,
  shotLogsBuffer,
  shotStatusJson,
  socketLooksPresent,
} from "./shotDocker";
import type { GantryState } from "../types";

export {
  bindDest,
  cranePath,
  craneRuntime,
  craneUser,
  hostBindPath,
  hostUserSpec,
  looksLikeConsole,
  looksLikeGantry,
  mergeBinds,
  normalizeName,
  ownerUserSpec,
  pickConsoleWorkload,
  stateOf,
  usableUserSpec,
  workloadRole,
} from "./dockerIdentity";
export type { CraneRuntime } from "./dockerIdentity";
export { cpuMemFromStats } from "./dockerStats";
export type { CpuMem } from "./dockerStats";

let client: Dockerode | null = null;

/** Default `/var/run/docker.sock`, then rootless `$XDG_RUNTIME_DIR/docker.sock` (Arch / SteamOS). */
export function dockerSocketCandidates(): string[] {
  const fromHost = process.env.DOCKER_HOST?.startsWith("unix://")
    ? process.env.DOCKER_HOST.slice("unix://".length)
    : "";
  const explicit = (fromHost || process.env.DOCKER_SOCKET || "").trim();
  if (explicit) {
    return [explicit];
  }
  const uid = process.getuid?.();
  const runtime = process.env.XDG_RUNTIME_DIR || (uid != null ? `/run/user/${uid}` : "");
  return [
    "/var/run/docker.sock",
    runtime ? `${runtime}/docker.sock` : "",
    runtime ? `${runtime}/podman/podman.sock` : "",
  ].filter(Boolean);
}

export function dockerSocketPath(): string {
  const candidates = dockerSocketCandidates();
  for (const p of candidates) {
    if (socketLooksPresent(p) || existsSync(p)) {
      return p;
    }
  }
  return candidates[0] || "/var/run/docker.sock";
}

export function docker(): Dockerode {
  if (!client) {
    client = new Dockerode({ socketPath: dockerSocketPath() });
  }
  return client;
}

export function resetDockerClient(): void {
  client = null;
}

export function dockerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("EACCES") || msg.includes("permission denied")) {
    return "Cannot talk to Docker (permission denied). Add this user to the docker group, or set DOCKER_SOCKET.";
  }
  if (msg.includes("ENOENT")) {
    return "Docker socket not found. Is Docker running? On Arch/SteamOS try DOCKER_SOCKET=$XDG_RUNTIME_DIR/docker.sock — or GANTREE_SHOT=1 for a screenshot yard.";
  }
  return msg;
}

export async function dockerHostInfo(): Promise<{ hostname: string; ncpu: number; memTotalBytes: number }> {
  if (shotDockerEnabled()) {
    return shotHostInfo();
  }
  const info = (await docker().info()) as { Name?: string; NCPU?: number; MemTotal?: number };
  return {
    hostname: (info.Name || "host").trim() || "host",
    ncpu: typeof info.NCPU === "number" && info.NCPU > 0 ? info.NCPU : 1,
    memTotalBytes: typeof info.MemTotal === "number" && info.MemTotal > 0 ? info.MemTotal : 0,
  };
}

export async function listRunningWorkloads(): Promise<{ id: string; name: string; image: string }[]> {
  if (shotDockerEnabled()) {
    return shotListRunningWorkloads();
  }
  const all = await docker().listContainers({ all: false });
  return all.map((c) => ({
    id: c.Id,
    name: normalizeName((c.Names ?? [])[0] || c.Id.slice(0, 12)),
    image: c.Image ?? "",
  }));
}

export type ConsoleWorkload = { id: string; name: string; image: string; running: boolean };

export async function findConsoleWorkload(): Promise<ConsoleWorkload | null> {
  if (shotDockerEnabled()) {
    return shotFindConsoleWorkload();
  }
  const all = await docker().listContainers({ all: true });
  const rows: ConsoleWorkload[] = all.map((c) => ({
    id: c.Id,
    name: normalizeName((c.Names ?? [])[0] || c.Id.slice(0, 12)),
    image: c.Image ?? "",
    running: (c.State || "").toLowerCase() === "running",
  }));
  return pickConsoleWorkload(rows);
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
  if (shotDockerEnabled()) {
    return shotListGantryContainers();
  }
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
  if (shotDockerEnabled()) {
    return shotInspect(name);
  }
  const list = await docker().listContainers({ all: true });
  const hit = list.find((c) => (c.Names ?? []).map(normalizeName).includes(name) || c.Id.startsWith(name));
  if (!hit) {
    return null;
  }
  const info = await docker().getContainer(hit.Id).inspect();
  return { listed: hit, info };
}

export async function containerLogsBuffer(id: string, tail: number): Promise<Buffer> {
  if (shotDockerEnabled()) {
    return shotLogsBuffer(id);
  }
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
  if (shotDockerEnabled()) {
    return Readable.from([shotLogsBuffer(id)]);
  }
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
  if (shotDockerEnabled()) {
    return shotContainerStats(id);
  }
  return docker().getContainer(id).stats({ stream: false });
}

export async function execGantry(
  id: string,
  args: string[],
): Promise<{ text: string; exitCode: number } | null> {
  if (shotDockerEnabled()) {
    if (args[0] === "status") {
      return { text: shotStatusJson(id), exitCode: 0 };
    }
    return { text: "", exitCode: 0 };
  }
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
