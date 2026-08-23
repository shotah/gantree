import type { AuthFlow, CatalogEntry, McpServer } from "../types";

/** Crane mouth — always in scope. Not MCP. */
export const CRANE_CORE_KEYS = [
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "CHANNEL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ALLOWED_USERS",
];

function ghRelease(repo: string, archive: string): string {
  return `https://github.com/shotah/${repo}/releases/download/{tag}/${archive}_{version}_{os}_{arch}.tar.gz`;
}

/**
 * Yard menu — listed here ≠ granted. Grant is `[[server]]` in that crane’s
 * mcp.toml (toggle on writes it; toggle off omits it). Profiles only seed
 * a *new* crane.
 */
export type PackageRef = {
  name: string;
  command: string;
  /** Directory under repos/ai-gantry/repos */
  repo: string;
  downloadTag?: string;
  downloadUrl?: string;
};

export const PACKAGES: PackageRef[] = [
  { name: "math", command: "mcp-go-math", repo: "mcp-go-math", downloadTag: "latest", downloadUrl: ghRelease("mcp-go-math", "mcp-go-math") },
  { name: "google-search", command: "mcp-gemini-google-search", repo: "mcp-gemini-search", downloadTag: "latest", downloadUrl: ghRelease("mcp-gemini-search", "mcp-gemini-google-search") },
  { name: "google", command: "google-mcp", repo: "google-mcp", downloadTag: "latest", downloadUrl: ghRelease("google-mcp", "google-mcp") },
  { name: "ghealth", command: "google-health-mcp", repo: "google-health-mcp", downloadTag: "latest", downloadUrl: ghRelease("google-health-mcp", "google-health-mcp") },
  { name: "strava", command: "strava-mcp", repo: "go-strava-mcp", downloadTag: "latest", downloadUrl: ghRelease("go-strava-mcp", "strava-mcp") },
  { name: "garmin", command: "garmin", repo: "go-garmin", downloadTag: "latest", downloadUrl: ghRelease("go-garmin", "garmin") },
  { name: "feeds", command: "feeds-mcp", repo: "feeds-mcp", downloadTag: "latest", downloadUrl: ghRelease("feeds-mcp", "feeds-mcp") },
  { name: "twitter", command: "twitter-mcp", repo: "twitter-mcp", downloadTag: "latest", downloadUrl: ghRelease("twitter-mcp", "twitter-mcp") },
  { name: "maps", command: "google-maps-mcp", repo: "google-maps-mcp", downloadTag: "latest", downloadUrl: ghRelease("google-maps-mcp", "google-maps-mcp") },
  { name: "youtube", command: "youtube-go-mcp", repo: "youtube-go-mcp", downloadTag: "latest", downloadUrl: ghRelease("youtube-go-mcp", "youtube-go-mcp") },
  { name: "cast", command: "mcp-beam", repo: "mcp-beam", downloadTag: "latest", downloadUrl: ghRelease("mcp-beam", "mcp-beam") },
  { name: "flights", command: "flights-search-mcp", repo: "flights-search-mcp", downloadTag: "latest", downloadUrl: ghRelease("flights-search-mcp", "flights-search-mcp") },
  { name: "rentals", command: "rentals-search-mcp", repo: "rentals-search-mcp", downloadTag: "latest", downloadUrl: ghRelease("rentals-search-mcp", "rentals-search-mcp") },
  { name: "cars", command: "cars-search-mcp", repo: "cars-search-mcp", downloadTag: "latest", downloadUrl: ghRelease("cars-search-mcp", "cars-search-mcp") },
];

export const SLIM_GRANT = ["google-search", "math"];
export const LIFE_GRANT = ["google-search", "math", "google", "maps"];
export const LIFE_CAST_GRANT = [...LIFE_GRANT, "cast", "youtube"];

/** Listed only — no guessed keys or auth. Used when host-manifest cannot run. */
export function fallbackEntry(pkg: PackageRef): CatalogEntry {
  return { name: pkg.name, command: pkg.command, envKeys: [], blurb: "" };
}

const AUTH_FLOWS = new Set<AuthFlow>(["pkce", "device", "mfa"]);

/** Parse `<binary> host-manifest` JSON (stdout). */
export function parseHostManifest(raw: string): CatalogEntry {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("host-manifest: no JSON object");
  }
  const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const name = String(j.name ?? "");
  const command = String(j.command ?? name);
  if (!name || !command) {
    throw new Error("host-manifest: name and command required");
  }
  const envKeys = Array.isArray(j.env_keys)
    ? j.env_keys.map(String)
    : Array.isArray(j.envKeys)
      ? j.envKeys.map(String)
      : [];
  const args = Array.isArray(j.args) ? j.args.map(String) : undefined;
  const auth_args = Array.isArray(j.auth_args) ? j.auth_args.map(String) : undefined;
  const flowRaw = typeof j.auth_flow === "string" ? j.auth_flow : undefined;
  const authFlow = flowRaw && AUTH_FLOWS.has(flowRaw as AuthFlow) ? (flowRaw as AuthFlow) : undefined;
  const download_tag = typeof j.download_tag === "string" ? j.download_tag : undefined;
  const download_url = typeof j.download_url === "string" ? j.download_url : undefined;
  return {
    name,
    command,
    args,
    auth_args,
    authFlow,
    download_tag,
    download_url,
    envKeys,
    homeOnly: Boolean(j.home_only ?? j.homeOnly),
    blurb: String(j.blurb ?? ""),
  };
}

export function serverFromCatalog(cat: CatalogEntry): McpServer {
  return {
    name: cat.name,
    command: cat.command,
    args: cat.args,
    auth_args: cat.auth_args,
    download_tag: cat.download_tag,
    download_url: cat.download_url,
    ...(cat.envKeys.length ? { env_keys: cat.envKeys } : {}),
  };
}

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (!k || seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function envKeysForServer(
  server: Pick<McpServer, "name" | "env_keys">,
  catalog: CatalogEntry[],
): string[] {
  const cat = catalog.find((c) => c.name === server.name);
  return uniqueKeys([...(cat?.envKeys ?? []), ...(server.env_keys ?? [])]);
}

export function secretKeysForGrant(
  granted: string[],
  catalog: CatalogEntry[],
  servers: Pick<McpServer, "name" | "env_keys">[] = [],
): string[] {
  const extra = [
    ...catalog.filter((c) => granted.includes(c.name)).flatMap((c) => c.envKeys),
    ...servers.filter((s) => granted.includes(s.name)).flatMap((s) => s.env_keys ?? []),
  ];
  return uniqueKeys([...CRANE_CORE_KEYS, ...extra]);
}
