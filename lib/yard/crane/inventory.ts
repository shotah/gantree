import { resolve } from "node:path";
import { findAvatar } from "../host/avatar";
import { containerLogsBuffer, dockerErrorMessage, inspectByName, listGantryContainers, normalizeName, stateOf } from "../host/docker";
import { envKeyNames, loadGantreeToml, tomlPath, yardRoot } from "../host/files";
import { decodeDockerLogs, parseLogText } from "../host/logs";
import { mcpHint, mcpSnapshot } from "../tools/mcp";
import type { GantryCard, YardInventory } from "../types";

function abs(p: string | undefined): string | null {
  if (!p) {
    return null;
  }
  return resolve(yardRoot(), p);
}

export async function listYard(): Promise<YardInventory> {
  const toml = loadGantreeToml();
  let dockerError: string | null = null;
  let listed: Awaited<ReturnType<typeof listGantryContainers>> = [];
  try {
    listed = await listGantryContainers();
  } catch (err) {
    dockerError = dockerErrorMessage(err);
  }

  if (toml?.gantry?.length) {
    const gantries = await Promise.all(
      toml.gantry.map(async (row) => {
        const name = row.container || row.slug;
        const hit = listed.find((c) => c.name === name || c.name === row.slug);
        return cardFrom({
          slug: row.slug,
          containerName: name,
          listed: hit,
          dataDir: abs(row.data_dir),
          personaDir: abs(row.persona_dir),
          mcpManifest: abs(row.mcp_manifest),
          envFile: abs(row.env_file),
        });
      }),
    );
    return { source: "gantree.toml", yard: toml.yard || "home", gantries, dockerError };
  }

  const gantries = await Promise.all(
    listed.map((c) =>
      cardFrom({
        slug: c.labels["gantree.slug"] || c.name,
        containerName: c.name,
        listed: c,
        dataDir: null,
        personaDir: null,
        mcpManifest: null,
        envFile: null,
      }),
    ),
  );
  return {
    source: "docker-discover",
    yard: toml?.yard || "home",
    gantries,
    dockerError: dockerError || (listed.length === 0 && !toml ? `No cranes found. Add ${tomlPath()} or run an ai-gantry container.` : null),
  };
}

export async function getGantry(slug: string): Promise<GantryCard | null> {
  const yard = await listYard();
  return yard.gantries.find((g) => g.slug === slug) ?? null;
}

async function cardFrom(opts: {
  slug: string;
  containerName: string;
  listed: { id: string; image: string; state: GantryCard["state"] } | undefined;
  dataDir: string | null;
  personaDir: string | null;
  mcpManifest: string | null;
  envFile: string | null;
}): Promise<GantryCard> {
  let image = opts.listed?.image ?? null;
  let state = opts.listed?.state ?? "unknown";
  let health: string | null = null;
  let startedAt: string | null = null;
  let restartCount: number | null = null;
  let model: string | null = null;
  let channel: string | null = null;
  let lastError: string | null = null;
  let lastTurn: string | null = null;
  if (opts.listed) {
    try {
      const inspected = await inspectByName(opts.listed.id);
      if (inspected) {
        image = inspected.info.Config.Image || image;
        state = stateOf(inspected.info.State.Status);
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
  }
  const snap = mcpSnapshot({
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
  if (opts.listed?.id) {
    const peek = await peekLogHints(opts.listed.id);
    lastError = peek.lastError;
    lastTurn = peek.lastTurn;
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
    mcpListed: snap.listed,
    mcpPublished: snap.published,
    mcpSkipped: snap.skipped,
    mcpHint: mcpHint(snap),
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
