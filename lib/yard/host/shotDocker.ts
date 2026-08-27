import { existsSync } from "node:fs";
import { cpus, hostname, totalmem } from "node:os";
import { loadEnvFile } from "./envfile";
import { loadGantreeToml } from "./files";
import { DEFAULT_IMAGE, type GantryState } from "../types";

type ListedContainer = {
  id: string;
  name: string;
  image: string;
  state: GantryState;
  status: string;
  labels: Record<string, string>;
};

const IMAGE = DEFAULT_IMAGE;
const SHA_PREFIX = "sha256:";

export function shotContainerId(slug: string): string {
  return `shot-${slug}`;
}

export function shotSlugFromId(id: string): string | null {
  if (id.startsWith("shot-")) {
    return id.slice("shot-".length) || null;
  }
  return id;
}

function tomlRows() {
  return loadGantreeToml()?.gantry ?? [];
}

function rowFor(name: string) {
  const rows = tomlRows();
  const slug = shotSlugFromId(name) ?? name;
  return rows.find((r) => r.slug === slug || r.container === name || r.slug === name) ?? null;
}

function envOf(row: { env_file?: string; slug: string }): Record<string, string> {
  return loadEnvFile(row.env_file ?? null);
}

function startedAt(): string {
  return new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
}

function imageId(slug: string): string {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  }
  return `${SHA_PREFIX}${(h >>> 0).toString(16).padStart(8, "0")}${"a1b2c3d4e5f6".repeat(5).slice(0, 56)}`;
}

export function shotListGantryContainers(): ListedContainer[] {
  return tomlRows().map((row) => {
    const slug = row.slug;
    return {
      id: shotContainerId(slug),
      name: row.container || slug,
      image: IMAGE,
      state: "running" as const,
      status: "Up 8 hours",
      labels: { "gantree.slug": slug },
    };
  });
}

export function shotListRunningWorkloads(): { id: string; name: string; image: string }[] {
  const cranes = shotListGantryContainers().map((c) => ({ id: c.id, name: c.name, image: c.image }));
  cranes.push({ id: "shot-console", name: "gantree", image: "shotah/gantree:latest" });
  return cranes;
}

export function shotFindConsoleWorkload(): { id: string; name: string; image: string; running: boolean } {
  return { id: "shot-console", name: "gantree", image: "shotah/gantree:latest", running: true };
}

export function shotHostInfo(): { hostname: string; ncpu: number; memTotalBytes: number } {
  const ncpu = cpus().length || 8;
  return {
    hostname: hostname() || "mini",
    ncpu,
    memTotalBytes: totalmem() || 16 * 1024 * 1024 * 1024,
  };
}

export type ShotInspectInfo = {
  Id: string;
  Image: string;
  RestartCount: number;
  Config: {
    Image: string;
    Env: string[];
    User?: string;
    Labels?: Record<string, string> | null;
  };
  State: {
    Status: string;
    Running: boolean;
    Paused: boolean;
    Health?: { Status: string };
    StartedAt: string;
  };
  HostConfig?: {
    NetworkMode?: string;
    Binds?: string[] | null;
    GroupAdd?: string[] | null;
  };
};

export function shotInspect(name: string): { listed: ListedContainer; info: ShotInspectInfo } | null {
  const row = rowFor(name);
  if (!row) {
    return null;
  }
  const listed = shotListGantryContainers().find((c) => c.id === shotContainerId(row.slug) || c.name === row.slug);
  if (!listed) {
    return null;
  }
  const env = envOf(row);
  const envList = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  return {
    listed,
    info: {
      Id: listed.id,
      Image: imageId(row.slug),
      RestartCount: 0,
      Config: {
        Image: IMAGE,
        Env: envList,
        User: "1000:1000",
        Labels: { "gantree.slug": row.slug },
      },
      State: {
        Status: "running",
        Running: true,
        Paused: false,
        Health: { Status: "healthy" },
        StartedAt: startedAt(),
      },
      HostConfig: { NetworkMode: "bridge", Binds: [], GroupAdd: null },
    },
  };
}

function wave(slug: string, at = Date.now()): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h + slug.charCodeAt(i) * (i + 1)) % 997;
  }
  return (Math.sin(at / 180_000 + h) + 1) / 2;
}

/** dockerode stats blob `cpuMemFromStats` understands. */
export function shotContainerStats(id: string): Record<string, unknown> {
  const slug = id === "shot-console" ? "console" : (shotSlugFromId(id) ?? id);
  const w = wave(slug);
  const ncpu = shotHostInfo().ncpu || 8;
  const want = slug === "console" ? 14 + w * 10 : 22 + w * 28;
  const sys = 10_000_000;
  const cpuDelta = Math.max(1, Math.round((want / (ncpu * 100)) * sys));
  const total = 80_000_000 + cpuDelta;
  const mem = slug === "console" ? 180_000_000 + w * 40_000_000 : 48_000_000 + w * 50_000_000;
  const ageSec = 8 * 3600 + (Date.now() % 60_000) / 1000;
  const rxRate = 3_000 + w * 6_000;
  const txRate = 700 + w * 1_400;
  return {
    cpu_stats: { cpu_usage: { total_usage: total }, system_cpu_usage: sys * 2, online_cpus: ncpu },
    precpu_stats: { cpu_usage: { total_usage: total - cpuDelta }, system_cpu_usage: sys },
    memory_stats: { usage: Math.round(mem), limit: shotHostInfo().memTotalBytes || 16_000_000_000 },
    networks: { eth0: { rx_bytes: Math.round(rxRate * ageSec), tx_bytes: Math.round(txRate * ageSec) } },
    blkio_stats: {
      io_service_bytes_recursive: [
        { op: "Read", value: Math.round(12_000_000 + w * 4_000_000) },
        { op: "Write", value: Math.round(3_000_000 + w * 2_000_000) },
      ],
    },
  };
}

export function shotStatusJson(id: string): string {
  const slug = shotSlugFromId(id) ?? id;
  const row = rowFor(slug);
  const env = row ? envOf(row) : {};
  const channel = env.CHANNEL || "telegram";
  return JSON.stringify({
    alive: true,
    ok: true,
    version: "0.4.2",
    commit: "c0ffee1",
    channel,
    mcp: { listed: 2, connected: 2, skipped: 0 },
  });
}

export function shotLogsBuffer(id: string): Buffer {
  const slug = shotSlugFromId(id) ?? id;
  const now = Date.now();
  const lines: string[] = [];
  lines.push(JSON.stringify({ time: new Date(now - 120_000).toISOString(), level: "INFO", msg: "session store ready" }));
  lines.push(JSON.stringify({ time: new Date(now - 90_000).toISOString(), level: "INFO", msg: "mcp server connected", server: "math" }));
  lines.push(JSON.stringify({
    time: new Date(now - 20_000).toISOString(),
    level: "INFO",
    msg: "turn perf",
    source: "user",
    user_id: "41001001",
    session_id: "s-shot",
    iterations: 3,
    recoveries: 0,
    prompt_est_tokens: 4200,
    gen_est_tokens: 380,
    prompt_tokens: 4100,
    completion_tokens: 360,
    total_tokens: 4460,
    outcome: "ok",
    duration_ms: 1800,
    model: "gemini-3.6-flash",
    turn_id: `t-${slug}-live`,
  }));
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

export function socketLooksPresent(path: string): boolean {
  if (!path) {
    return false;
  }
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}
