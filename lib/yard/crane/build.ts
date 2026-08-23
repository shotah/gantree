import { chmodSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_CAST_GRANT, LIFE_GRANT, SLIM_GRANT, loadCatalog } from "../tools/catalog";
import { cranePath, craneRuntime, docker, hostBindPath, hostUserSpec, inspectByName, mergeBinds, normalizeName } from "../host/docker";
import { writeEnvFile } from "../host/envfile";
import { stringifyMcpToml, tomlPath, upsertTomlGantry, writeText, yardRoot } from "../host/files";
import { seedPersonaFiles } from "./seed";
import { DEFAULT_IMAGE, type McpServer } from "../types";
import { loadObservePrefs } from "../observe/prefs";

export { DEFAULT_IMAGE };

export type BuildInput = {
  slug: string;
  yard?: "home" | "cloud";
  profile?: "slim" | "life" | "life-cast";
  model?: string;
  channel?: string;
  image?: string;
  persona?: string;
  env?: Record<string, string>;
};

function slugOk(slug: string): boolean {
  return /^[a-z][a-z0-9-]{0,31}$/.test(slug);
}

function profileNames(profile: BuildInput["profile"], yard: "home" | "cloud"): string[] {
  if (profile === "life-cast") {
    return yard === "cloud" ? LIFE_GRANT : LIFE_CAST_GRANT;
  }
  if (profile === "life") {
    return LIFE_GRANT;
  }
  return SLIM_GRANT;
}

export function craneDir(slug: string): string {
  return resolve(yardRoot(), "gantries", slug);
}

export function writeCraneFiles(input: BuildInput): {
  dir: string;
  personaDir: string;
  dataDir: string;
  mcpManifest: string;
  envFile: string;
} {
  const slug = input.slug;
  const yard = input.yard ?? "home";
  const dir = craneDir(slug);
  const personaDir = resolve(dir, "persona");
  const dataDir = resolve(dir, "data");
  const mcpManifest = resolve(dir, "mcp.toml");
  const envFile = resolve(dir, ".env");
  mkdirSync(personaDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  chmodSync(personaDir, 0o777);
  chmodSync(dataDir, 0o777);

  const names = profileNames(input.profile ?? "slim", yard);
  const servers: McpServer[] = names.map((name) => {
    const cat = loadCatalog().find((c) => c.name === name);
    return cat
      ? {
          name: cat.name,
          command: cat.command,
          args: cat.args,
          auth_args: cat.auth_args,
          download_tag: cat.download_tag,
          download_url: cat.download_url,
        }
      : { name, command: name };
  });
  writeText(mcpManifest, stringifyMcpToml(servers));
  seedPersonaFiles(personaDir, slug, { persona: input.persona });
  writeEnvFile(envFile, {
    LLM_MODEL: input.model || "gemini-3.5-flash",
    CHANNEL: input.channel || "telegram",
    ...(input.env ?? {}),
  });
  const user = hostUserSpec(dataDir, dir, tomlPath());
  writeText(
    resolve(dir, "compose.yml"),
    [
      `services:`,
      `  ${slug}:`,
      `    image: ${input.image || loadObservePrefs().defaultImage}`,
      `    container_name: ${slug}`,
      `    restart: unless-stopped`,
      ...(user ? [`    user: "${user}"`] : [`    # user: "UID:GID" — account that owns data/`]),
      `    env_file: .env`,
      `    environment:`,
      `      HOME: /data`,
      `      PERSONA_DIR: /persona`,
      `      DATA_DIR: /data`,
      `      MCP_MANIFEST: /etc/gantry/mcp.toml`,
      `    labels:`,
      `      gantree.slug: ${slug}`,
      `    volumes:`,
      `      - ./persona:/persona`,
      `      - ./data:/data`,
      `      - ./mcp.toml:/etc/gantry/mcp.toml`,
      `    # No ports — outbound chat only.`,
      ``,
    ].join("\n"),
  );
  upsertTomlGantry(
    {
      slug,
      container: slug,
      data_dir: `./gantries/${slug}/data`,
      persona_dir: `./gantries/${slug}/persona`,
      mcp_manifest: `./gantries/${slug}/mcp.toml`,
      env_file: `./gantries/${slug}/.env`,
    },
    yard,
  );
  return { dir, personaDir, dataDir, mcpManifest, envFile };
}

export async function createOrReplaceContainer(opts: {
  slug: string;
  image: string;
  env: Record<string, string>;
  personaDir: string;
  dataDir: string;
  mcpManifest: string;
}): Promise<{ id: string; detail: string }> {
  const existing = await inspectByName(opts.slug);
  const runtime = craneRuntime(existing?.info, [
    resolve(opts.dataDir, "gantry.db"),
    opts.dataDir,
    opts.personaDir,
    opts.mcpManifest,
    tomlPath(),
  ]);
  if (existing) {
    const c = docker().getContainer(existing.info.Id);
    try {
      await c.stop({ t: 5 });
    } catch {
      /* already stopped */
    }
    await c.remove({ force: true });
  }
  dropStaleDoctorSnapshot(opts.dataDir);
  const requiredBinds = [
    `${hostBindPath(opts.personaDir)}:/persona`,
    `${hostBindPath(opts.dataDir)}:/data`,
    `${hostBindPath(opts.mcpManifest)}:/etc/gantry/mcp.toml`,
  ];
  const binds = mergeBinds(requiredBinds, runtime.binds);
  const created = await docker().createContainer({
    name: opts.slug,
    Image: opts.image,
    User: runtime.user,
    Labels: { ...runtime.labels, "gantree.slug": opts.slug },
    Env: Object.entries({
      PERSONA_DIR: "/persona",
      DATA_DIR: "/data",
      MCP_MANIFEST: "/etc/gantry/mcp.toml",
      ...opts.env,
      HOME: "/data",
      PATH: cranePath({
        envPath: opts.env.PATH,
        existingEnv: existing?.info.Config?.Env,
        binds,
      }),
    }).map(([k, v]) => `${k}=${v}`),
    HostConfig: {
      Binds: binds,
      RestartPolicy: { Name: "unless-stopped" },
      NetworkMode: runtime.networkMode,
      GroupAdd: runtime.groupAdd,
    },
    OpenStdin: opts.env.CHANNEL === "stdio",
    Tty: opts.env.CHANNEL === "stdio",
  });
  await created.start();
  const who = runtime.user ? ` as ${runtime.user}` : "";
  return { id: created.id, detail: `built crane ${normalizeName(opts.slug)} from ${opts.image}${who}` };
}

/** Boot snapshot from the previous container — recreate must not keep its skip list. */
export function dropStaleDoctorSnapshot(dataDir: string): void {
  try {
    unlinkSync(resolve(dataDir, "doctor.json"));
  } catch {
    /* missing is fine */
  }
}

export async function buildCrane(input: BuildInput): Promise<{ ok: boolean; detail: string; slug: string }> {
  const slug = input.slug.trim().toLowerCase();
  if (!slugOk(slug)) {
    return { ok: false, detail: "slug must be lowercase letters, numbers, dashes", slug };
  }
  if (input.yard === "cloud" && input.profile === "life-cast") {
    return { ok: false, detail: "life-cast is home only (host network / mDNS)", slug };
  }
  const files = writeCraneFiles({ ...input, slug });
  const image = input.image || loadObservePrefs().defaultImage;
  try {
    const { pullImage } = await import("../host/docker");
    await pullImage(image);
  } catch {
    /* local image may already exist */
  }
  const env = {
    LLM_MODEL: input.model || "gemini-3.5-flash",
    CHANNEL: input.channel || "telegram",
    ...(input.env ?? {}),
  };
  try {
    const created = await createOrReplaceContainer({
      slug,
      image,
      env,
      personaDir: files.personaDir,
      dataDir: files.dataDir,
      mcpManifest: files.mcpManifest,
    });
    return { ok: true, detail: created.detail, slug };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err), slug };
  }
}
