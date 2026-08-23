import { resolve } from "node:path";
import { findAvatar } from "../host/avatar";
import {
  containerLogsBuffer,
  dockerErrorMessage,
  inspectByName,
  listGantryContainers,
  normalizeName,
  stateOf,
  type ListedContainer,
} from "../host/docker";
import { envKeyNames, loadGantreeToml, tomlPath, yardRoot } from "../host/files";
import { decodeDockerLogs, parseLogText } from "../host/logs";
import { craneNags, mcpHint, mcpSnapshot } from "../tools/mcp";
import type { GantryCard, YardInventory } from "../types";

export type ListYardOpts = { waitDocker?: boolean };

type DockerEnrich = {
  image: string | null;
  state: GantryCard["state"];
  health: string | null;
  startedAt: string | null;
  restartCount: number | null;
  model: string | null;
  channel: string | null;
  lastError: string | null;
  lastTurn: string | null;
};

type DockerSnap = {
  listed: ListedContainer[];
  enrich: Map<string, DockerEnrich>;
  dockerError: string | null;
  ready: boolean;
};

function emptySnap(): DockerSnap {
  return { listed: [], enrich: new Map(), dockerError: null, ready: false };
}

let snap: DockerSnap = emptySnap();
let inflight: Promise<void> | null = null;
let generation = 0;

function abs(p: string | undefined): string | null {
  if (!p) {
    return null;
  }
  return resolve(yardRoot(), p);
}

/** Test helper: drop the in-process Docker snapshot as if the process bounced. */
export function resetYardDockerCache(): void {
  generation += 1;
  snap = emptySnap();
  inflight = null;
}

export function kickYardDocker(): Promise<void> {
  if (!inflight) {
    inflight = refreshYardDocker().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function refreshYardDocker(): Promise<void> {
  const gen = generation;
  try {
    const listed = await listGantryContainers();
    const enrich = new Map<string, DockerEnrich>();
    await Promise.all(
      listed.map(async (c) => {
        enrich.set(c.id, await dockerEnrich(c));
      }),
    );
    if (gen !== generation) {
      return;
    }
    snap = { listed, enrich, dockerError: null, ready: true };
  } catch (err) {
    if (gen !== generation) {
      return;
    }
    snap = { listed: [], enrich: new Map(), dockerError: dockerErrorMessage(err), ready: true };
  }
}

async function dockerEnrich(listed: ListedContainer): Promise<DockerEnrich> {
  let image = listed.image ?? null;
  let state = listed.state ?? "unknown";
  let health: string | null = null;
  let startedAt: string | null = null;
  let restartCount: number | null = null;
  let model: string | null = null;
  let channel: string | null = null;
  try {
    const inspected = await inspectByName(listed.id);
    if (inspected) {
      image = inspected.info.Config.Image || image;
      const st = inspected.info.State;
      state = stateOf(st.Status, { running: st.Running, paused: st.Paused });
      health = inspected.info.State.Health?.Status ?? null;
      startedAt = saneStarted(inspected.info.State.StartedAt);
      restartCount = typeof inspected.info.RestartCount === "number" ? inspected.info.RestartCount : null;
      const env = inspected.info.Config.Env ?? [];
      model = envVal(env, "LLM_MODEL");
      channel = envVal(env, "CHANNEL");
    }
  } catch {
    /* inspect is best-effort */
  }
  const peek = await peekLogHints(listed.id);
  return {
    image,
    state,
    health,
    startedAt,
    restartCount,
    model,
    channel,
    lastError: peek.lastError,
    lastTurn: peek.lastTurn,
  };
}

export async function listYard(opts?: ListYardOpts): Promise<YardInventory> {
  const job = kickYardDocker();
  if (opts?.waitDocker !== false) {
    await job;
  }
  return buildInventory();
}

export async function getGantry(slug: string): Promise<GantryCard | null> {
  const yard = await listYard();
  return yard.gantries.find((g) => g.slug === slug) ?? null;
}

function buildInventory(): YardInventory {
  const toml = loadGantreeToml();
  const dockerPending = !snap.ready;
  const listed = snap.listed;
  const dockerError = snap.ready
    ? snap.dockerError || (listed.length === 0 && !toml ? `No cranes found. Add ${tomlPath()} or run an ai-gantry container.` : null)
    : null;

  if (toml?.gantry?.length) {
    const gantries = toml.gantry.map((row) => {
      const name = row.container || row.slug;
      const hit = listed.find((c) => c.name === name || c.name === row.slug);
      return cardFrom({
        slug: row.slug,
        containerName: name,
        listed: hit,
        enrich: hit ? snap.enrich.get(hit.id) : undefined,
        dockerPending: dockerPending && !hit,
        dataDir: abs(row.data_dir),
        personaDir: abs(row.persona_dir),
        mcpManifest: abs(row.mcp_manifest),
        envFile: abs(row.env_file),
      });
    });
    return { source: "gantree.toml", yard: toml.yard || "home", gantries, dockerError, dockerPending };
  }

  const gantries = listed.map((c) =>
    cardFrom({
      slug: c.labels["gantree.slug"] || c.name,
      containerName: c.name,
      listed: c,
      enrich: snap.enrich.get(c.id),
      dockerPending: false,
      dataDir: null,
      personaDir: null,
      mcpManifest: null,
      envFile: null,
    }),
  );
  return {
    source: "docker-discover",
    yard: toml?.yard || "home",
    gantries,
    dockerError,
    dockerPending,
  };
}

function cardFrom(opts: {
  slug: string;
  containerName: string;
  listed: ListedContainer | undefined;
  enrich: DockerEnrich | undefined;
  dockerPending: boolean;
  dataDir: string | null;
  personaDir: string | null;
  mcpManifest: string | null;
  envFile: string | null;
}): GantryCard {
  const image = opts.enrich?.image ?? opts.listed?.image ?? null;
  const state = opts.enrich?.state ?? opts.listed?.state ?? "unknown";
  const health = opts.enrich?.health ?? null;
  const startedAt = opts.enrich?.startedAt ?? null;
  const restartCount = opts.enrich?.restartCount ?? null;
  let model = opts.enrich?.model ?? null;
  let channel = opts.enrich?.channel ?? null;
  const lastError = opts.enrich?.lastError ?? null;
  const lastTurn = opts.enrich?.lastTurn ?? null;
  const snapMcp = mcpSnapshot({
    mcpManifest: opts.mcpManifest,
    envFile: opts.envFile,
    dataDir: opts.dataDir,
  });
  const env = envKeyNames(opts.envFile);
  if (!model) {
    model = env.valuesPresent.LLM_MODEL ? "set in .env" : null;
  }
  if (!channel) {
    channel = pickChannel(env.keys);
  }
  return {
    slug: opts.slug,
    containerName: opts.containerName,
    containerId: opts.listed?.id ?? null,
    image,
    state,
    health,
    startedAt,
    restartCount,
    model,
    channel,
    lastError,
    lastTurn,
    mcpListed: snapMcp.listed,
    mcpPublished: snapMcp.published,
    mcpSkipped: snapMcp.skipped,
    mcpHint: mcpHint(snapMcp),
    nags: craneNags(state, snapMcp, { dockerPending: opts.dockerPending }),
    dataDir: opts.dataDir,
    personaDir: opts.personaDir,
    mcpManifest: opts.mcpManifest,
    envFile: opts.envFile,
    avatarRev: findAvatar(opts.personaDir)?.rev ?? null,
  };
}

function saneStarted(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t < Date.parse("2000-01-01")) {
    return null;
  }
  return raw;
}

async function peekLogHints(id: string): Promise<{ lastError: string | null; lastTurn: string | null }> {
  try {
    const lines = parseLogText(decodeDockerLogs(await containerLogsBuffer(id, 40)));
    const err = [...lines].reverse().find((l) => l.kind === "error");
    const turn = [...lines].reverse().find((l) => l.kind === "turn" || l.turnId);
    return { lastError: err?.msg.slice(0, 160) ?? null, lastTurn: turn?.ts ?? null };
  } catch {
    return { lastError: null, lastTurn: null };
  }
}

function envVal(env: string[], key: string): string | null {
  const row = env.find((e) => e.startsWith(`${key}=`));
  return row ? row.slice(key.length + 1) || null : null;
}

function pickChannel(keys: string[]): string | null {
  if (keys.includes("TELEGRAM_BOT_TOKEN")) {
    return "telegram";
  }
  if (keys.includes("DISCORD_BOT_TOKEN")) {
    return "discord";
  }
  if (keys.includes("SLACK_BOT_TOKEN")) {
    return "slack";
  }
  return null;
}

export function containerDisplayName(name: string): string {
  return normalizeName(name);
}
