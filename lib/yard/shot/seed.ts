import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeCraneFiles } from "@/lib/yard/crane/build";
import { defaultFieldSelection, injectOperatorIntoPersona } from "@/lib/yard/crane/injectPersona";
import { personaMarkdown, selfMarkdown } from "@/lib/yard/crane/seed";
import {
  addOperator,
  listOperators,
  resetOperatorPassphrase,
  setOperatorAccess,
  setupOperator,
  updateOwnProfile,
} from "@/lib/yard/door/operators";
import { saveOperatorAvatar } from "@/lib/yard/door/profile";
import { recordYardEvent } from "@/lib/yard/door/events";
import { saveAvatar } from "@/lib/yard/host/avatar";
import { writeEnvFile } from "@/lib/yard/host/envfile";
import { mergeTomlTagColors, setTomlGantryTags, writeText, yardRoot } from "@/lib/yard/host/files";
import {
  dropCraneSamples,
  dropMachineSamples,
  persistHost,
  persistMachine,
  persistMcp,
  persistTurn,
  persistUptime,
} from "@/lib/yard/observe/memory";
import type { HostSample, StatSample, TurnSample } from "@/lib/yard/types";
import { SHOT_CRANE_USERS, SHOT_CRANES, SHOT_OPERATORS, SHOT_TAG_COLORS, type ShotOperator } from "./catalog";
import { tileJpeg } from "./tileJpeg";

export function parseSeedArgs(argv: string[]): { help: boolean } {
  const out = { help: false };
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else {
      throw new Error(`unknown arg ${a}`);
    }
  }
  return out;
}

function operatorByName(name: string): ShotOperator {
  const hit = SHOT_OPERATORS.find((o) => o.name === name);
  if (!hit) {
    throw new Error(`shot catalog missing operator ${name}`);
  }
  return hit;
}

function ensureOperator(spec: ShotOperator): string {
  const existing = listOperators().find((o) => o.name.toLowerCase() === spec.name.toLowerCase());
  let id: string;
  if (existing) {
    id = existing.id;
    const reset = resetOperatorPassphrase(id, spec.passphrase);
    if (!reset.ok) {
      throw new Error(reset.error);
    }
  } else if (listOperators().length === 0) {
    const first = setupOperator(spec.name, spec.passphrase);
    if (!first.ok) {
      throw new Error(first.error);
    }
    id = first.operator.id;
  } else {
    const added = addOperator(spec.name, spec.passphrase, spec.role, spec.cranes);
    if (!added.ok) {
      throw new Error(added.error);
    }
    id = added.operator.id;
  }
  const access = setOperatorAccess(id, spec.role, spec.cranes);
  if (!access.ok) {
    throw new Error(access.error);
  }
  const profile = updateOwnProfile(id, {
    displayName: spec.displayName,
    email: spec.email,
    description: spec.description,
    timezone: spec.timezone,
    location: spec.location,
    channels: { telegram: [spec.telegram], slack: [], discord: [] },
  });
  if (!profile.ok) {
    throw new Error(profile.error);
  }
  const av = saveOperatorAvatar(id, tileJpeg(spec.displayName));
  if (!av.ok) {
    throw new Error(av.error);
  }
  return id;
}

function overwriteText(path: string, body: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* missing, or we'll let writeText throw */
  }
  writeText(path, body);
}

function writeOauthStub(dataDir: string, name: string): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(resolve(dataDir, `${name}-oauth.json`), `${JSON.stringify({ ok: true, shot: true }, null, 2)}\n`);
}

function seedCrane(spec: (typeof SHOT_CRANES)[number]): void {
  const about = operatorByName(spec.about);
  const files = writeCraneFiles({
    slug: spec.slug,
    yard: "home",
    profile: spec.profile,
    model: spec.model,
    channel: spec.channel,
    env: spec.env,
  });
  writeEnvFile(files.envFile, {
    LLM_MODEL: spec.model,
    CHANNEL: spec.channel,
    ...spec.env,
  });
  setTomlGantryTags(spec.slug, spec.tags);
  const persona = injectOperatorIntoPersona(
    personaMarkdown(spec.slug),
    {
      displayName: about.displayName,
      email: about.email,
      description: about.description,
      timezone: about.timezone,
      location: about.location,
      channels: { telegram: [about.telegram], slack: [], discord: [] },
    },
    defaultFieldSelection({
      displayName: about.displayName,
      email: about.email,
      description: about.description,
      timezone: about.timezone,
      location: about.location,
      channels: { telegram: [about.telegram], slack: [], discord: [] },
    }),
  );
  overwriteText(resolve(files.personaDir, "PERSONA.md"), persona);
  overwriteText(resolve(files.personaDir, "SELF.md"), `${selfMarkdown().trim()}\n\n## Shot notes\n\n${spec.self}\n`);
  saveAvatar(files.personaDir, tileJpeg(spec.slug));
  for (const name of spec.oauth) {
    writeOauthStub(files.dataDir, name);
  }
}

function mulberry(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function seedMetrics(now: number): void {
  dropMachineSamples();
  const hostRand = mulberry(hashSeed("machine"));
  const ncpu = 8;
  const memTotal = 16 * 1024 * 1024 * 1024;
  const hours = 36;
  const step = 5 * 60_000;
  const points = Math.round((hours * 60 * 60_000) / step);

  for (let i = points; i >= 0; i--) {
    const at = now - i * step;
    const w = 0.5 + 0.5 * Math.sin(at / 2_400_000);
    persistMachine({
      at,
      ncpu,
      memTotalBytes: memTotal,
      craneCpu: 12 + w * 28 + hostRand() * 6,
      consoleCpu: 3 + hostRand() * 5,
      otherCpu: 1 + hostRand() * 3,
      craneMem: 280_000_000 + w * 120_000_000,
      consoleMem: 190_000_000 + hostRand() * 40_000_000,
      otherMem: 80_000_000,
      craneRx: 4_000_000 + w * 9_000_000,
      craneTx: 900_000 + w * 2_000_000,
      consoleRx: 200_000,
      consoleTx: 80_000,
      otherRx: 50_000,
      otherTx: 20_000,
    } satisfies HostSample);
  }

  for (const crane of SHOT_CRANES) {
    dropCraneSamples(crane.slug);
    const rng = mulberry(hashSeed(crane.slug));
    const users = SHOT_CRANE_USERS[crane.slug] ?? ["41001001"];
    const published = crane.oauth.length > 0 || crane.profile === "slim" ? (crane.profile === "slim" ? 2 : 3) : 2;
    const skipped = crane.slug === "piper" ? 1 : 0;

    for (let i = points; i >= 0; i--) {
      const at = now - i * step;
      const w = 0.4 + 0.6 * Math.sin(at / 1_800_000 + rng());
      persistHost(crane.slug, {
        at,
        cpuPercent: 3 + w * 14 + rng() * 2,
        memBytes: 42_000_000 + w * 38_000_000,
        memLimitBytes: memTotal,
        netRxBytes: 800_000 + w * 3_000_000,
        netTxBytes: 200_000 + w * 800_000,
        blkReadBytes: 6_000_000 + w * 2_000_000,
        blkWriteBytes: 1_500_000 + w * 900_000,
        diskBytes: i % 12 === 0 ? 24_000_000 + Math.round(w * 8_000_000) : null,
      } satisfies StatSample);
      persistMcp(crane.slug, { at, published, skipped });
      persistUptime(crane.slug, {
        at,
        uptimeSeconds: Math.round((points - i) * (step / 1000)),
        restartCount: 0,
      });
    }

    const turnN = 90 + Math.floor(rng() * 40);
    for (let t = 0; t < turnN; t++) {
      const at = now - Math.round(rng() * hours * 60 * 60_000);
      const source = rng() < 0.72 ? "user" : rng() < 0.55 ? "cron" : "watch";
      const userId = source === "user" ? users[Math.floor(rng() * users.length)] ?? users[0] : null;
      const promptEst = 2500 + Math.round(rng() * 9000);
      const genEst = 180 + Math.round(rng() * 900);
      const native = rng() < 0.65;
      const promptTok = native ? promptEst - Math.round(rng() * 200) : null;
      const genTok = native ? genEst - Math.round(rng() * 40) : null;
      persistTurn(crane.slug, {
        at,
        key: `shot-${crane.slug}-${t}`,
        rounds: 1 + Math.floor(rng() * 4),
        recoveries: rng() < 0.08 ? 1 : 0,
        estTokens: promptEst + genEst,
        promptEstTokens: promptEst,
        genEstTokens: genEst,
        promptTokens: promptTok,
        completionTokens: genTok,
        totalTokens: promptTok != null && genTok != null ? promptTok + genTok : null,
        usageRounds: native ? 1 : null,
        source,
        userId,
        sessionId: source === "user" ? `s-${crane.slug}-${t}` : null,
        outcome: rng() < 0.94 ? "ok" : "error",
        durationMs: 800 + Math.round(rng() * 4200),
        model: crane.model,
        finishReason: "stop",
      } satisfies TurnSample);
    }
  }
}

export type SeedReport = {
  operators: { name: string; id: string }[];
  cranes: string[];
  root: string;
};

export function seedYard(now = Date.now()): SeedReport {
  const ids: { name: string; id: string }[] = [];
  for (const op of SHOT_OPERATORS) {
    ids.push({ name: op.name, id: ensureOperator(op) });
  }
  for (const crane of SHOT_CRANES) {
    seedCrane(crane);
  }
  mergeTomlTagColors(SHOT_TAG_COLORS);
  seedMetrics(now);
  const bob = ids.find((o) => o.name === "bob");
  recordYardEvent({ kind: "setup", operatorId: bob?.id, detail: "screenshot yard" });
  for (const crane of SHOT_CRANES) {
    recordYardEvent({ kind: "grant", slug: crane.slug, operatorId: bob?.id, detail: `${crane.profile} profile` });
  }
  return { operators: ids, cranes: SHOT_CRANES.map((c) => c.slug), root: yardRoot() };
}
