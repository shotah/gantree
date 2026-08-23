import { docker, pullImage } from "../host/docker";
import { loadEnvFile } from "../host/envfile";
import { backupFiles } from "../host/files";
import { fetchNeedsReload, toolsFetch } from "../tools/auth";
import type { DoctorReport } from "../types";
import { DEFAULT_IMAGE, createOrReplaceContainer } from "./build";
import { doctor } from "./doctor";
import { getGantry } from "./inventory";

export type RunAction = "start" | "stop" | "recreate" | "backup" | "pin";

export type DoctorWaitDeps = {
  doctor?: (slug: string) => Promise<DoctorReport | null>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  intervalMs?: number;
};

function fails(report: DoctorReport): string {
  const bad = report.checks.filter((c) => !c.ok).map((c) => c.detail);
  return bad.length ? bad.join("; ") : report.checks.map((c) => c.detail).join("; ");
}

/** After start/recreate: wait until process is up and doctor is green or honestly red. */
export async function waitUntilDoctorSettled(slug: string, deps: DoctorWaitDeps = {}): Promise<{ ok: boolean; detail: string }> {
  const inspect = deps.doctor ?? doctor;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const intervalMs = deps.intervalMs ?? 1_500;
  const start = now();
  let last: DoctorReport | null = null;

  while (now() - start < timeoutMs) {
    last = await inspect(slug);
    if (last) {
      const processCheck = last.checks.find((c) => c.id === "process");
      const processOk = processCheck?.ok === true;
      const health = last.checks.find((c) => c.id === "docker-health");
      const starting = Boolean(health && /starting/i.test(health.detail));
      const bouncing = /restarting/i.test(processCheck?.detail ?? "");
      if (processOk && !starting && !bouncing) {
        return { ok: true, detail: last.ok ? "doctor ok" : `doctor: ${fails(last)}` };
      }
    }
    await sleep(intervalMs);
  }

  if (last?.checks.find((c) => c.id === "process")?.ok) {
    return { ok: true, detail: `doctor still settling: ${fails(last)}` };
  }
  return { ok: false, detail: last ? `timed out: ${fails(last)}` : "timed out waiting for container to come up" };
}

/** After recreate: download MCP bins into /data/bin, then reload so they publish. */
export async function fetchBinsAndReload(slug: string): Promise<{ ok: boolean; detail: string }> {
  const fetched = await toolsFetch(slug);
  if (!fetched.ok) {
    if (/could not exec/i.test(fetched.detail) || /must be running/i.test(fetched.detail)) {
      return { ok: true, detail: fetched.detail };
    }
    return fetched;
  }
  if (!fetchNeedsReload(fetched.detail)) {
    return fetched;
  }
  const g = await getGantry(slug);
  if (!g?.containerId) {
    return { ok: false, detail: `${fetched.detail}; reload skipped (no container)` };
  }
  try {
    await docker().getContainer(g.containerId).restart({ t: 5 });
  } catch (err) {
    return { ok: false, detail: `${fetched.detail}; reload failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  const settled = await waitUntilDoctorSettled(slug);
  return { ok: settled.ok, detail: `${fetched.detail}; reloaded; ${settled.detail}` };
}

export async function run(slug: string, action: RunAction, image?: string): Promise<{ ok: boolean; detail: string }> {
  const g = await getGantry(slug);
  if (!g) {
    return { ok: false, detail: `unknown gantry ${slug}` };
  }
  if (action === "backup") {
    const dest = backupFiles(g.dataDir, g.personaDir);
    return dest
      ? { ok: true, detail: `backed up gantry.db + SELF.md to ${dest}` }
      : { ok: false, detail: "no data_dir / persona_dir in inventory — cannot backup" };
  }
  if (action === "recreate" || action === "pin") {
    if (!g.personaDir || !g.dataDir || !g.mcpManifest) {
      return { ok: false, detail: "recreate needs persona/data/mcp paths in gantree.toml" };
    }
    const pin = image || g.image || DEFAULT_IMAGE;
    if (action === "pin") {
      try {
        await pullImage(pin);
      } catch (err) {
        return { ok: false, detail: `pull failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    try {
      const created = await createOrReplaceContainer({
        slug: g.containerName,
        image: pin,
        env: loadEnvFile(g.envFile),
        personaDir: g.personaDir,
        dataDir: g.dataDir,
        mcpManifest: g.mcpManifest,
      });
      const settled = await waitUntilDoctorSettled(slug);
      if (!settled.ok) {
        return { ok: false, detail: `${created.detail}; ${settled.detail}` };
      }
      const fetched = await fetchBinsAndReload(slug);
      return { ok: fetched.ok, detail: `${created.detail}; ${settled.detail}; ${fetched.detail}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!g.containerId) {
    return { ok: false, detail: "no container attached" };
  }
  const c = docker().getContainer(g.containerId);
  try {
    if (action === "start") {
      await c.start();
      const settled = await waitUntilDoctorSettled(slug);
      return { ok: settled.ok, detail: `started; ${settled.detail}` };
    }
    await c.stop();
    return { ok: true, detail: "stopped" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
