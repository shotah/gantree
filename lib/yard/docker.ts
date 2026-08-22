import Dockerode from "dockerode";
import { decodeDockerLogs } from "./logs";
import type { GantryState } from "./types";

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

export function stateOf(raw: string | undefined): GantryState {
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
