import { chmodSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_CAST_GRANT, LIFE_GRANT, SLIM_GRANT, loadCatalog } from "./catalog";
import { craneRuntime, docker, hostUserSpec, inspectByName, mergeBinds, normalizeName } from "./docker";
import { writeEnvFile } from "./envfile";
import { stringifyMcpToml, upsertTomlGantry, writeText, yardRoot } from "./files";
import { DEFAULT_IMAGE, type McpServer } from "./types";

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
  writeText(
    resolve(personaDir, "PERSONA.md"),
    input.persona?.trim() || `# ${slug}\n\nA long-horizon personal agent.\n`,
  );
  writeEnvFile(envFile, {
    LLM_MODEL: input.model || "gemini-3.5-flash",
    CHANNEL: input.channel || "telegram",
    ...(input.env ?? {}),
  });
  const user = hostUserSpec();
  writeText(
    resolve(dir, "compose.yml"),
    [
      `services:`,
      `  ${slug}:`,
      `    image: ${input.image || DEFAULT_IMAGE}`,
      `    container_name: ${slug}`,
      `    restart: unless-stopped`,
      ...(user ? [`    user: "${user}"`] : [`    # user: "UID:GID" — account that owns data/`]),
      `    env_file: .env`,
      `    environment:`,
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
  const runtime = craneRuntime(existing?.info);
  if (existing) {
    const c = docker().getContainer(existing.info.Id);
    try {
      await c.stop({ t: 5 });
    } catch {
      /* already stopped */
    }
    await c.remove({ force: true });
  }
  const requiredBinds = [`${opts.personaDir}:/persona`, `${opts.dataDir}:/data`, `${opts.mcpManifest}:/etc/gantry/mcp.toml`];
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
      PATH: `/data/bin:${opts.env.PATH || "/usr/local/bin:/usr/bin:/bin"}`,
    }).map(([k, v]) => `${k}=${v}`),
    HostConfig: {
      Binds: mergeBinds(requiredBinds, runtime.binds),
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

export async function buildCrane(input: BuildInput): Promise<{ ok: boolean; detail: string; slug: string }> {
  const slug = input.slug.trim().toLowerCase();
  if (!slugOk(slug)) {
    return { ok: false, detail: "slug must be lowercase letters, numbers, dashes", slug };
  }
  if (input.yard === "cloud" && input.profile === "life-cast") {
    return { ok: false, detail: "life-cast is home only (host network / mDNS)", slug };
  }
  const files = writeCraneFiles({ ...input, slug });
  const image = input.image || DEFAULT_IMAGE;
  try {
    const { pullImage } = await import("./docker");
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
