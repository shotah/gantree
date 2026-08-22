import type { AuthFlow, CatalogEntry } from "./types";

/** Crane mouth — always in scope. Not MCP. */
export const CRANE_CORE_KEYS = [
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "CHANNEL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ALLOWED_USERS",
];

/** Yard offers these packages. Shape comes from `<command> host-manifest`. */
export type PackageRef = {
  name: string;
  command: string;
  /** Directory under repos/ai-gantry/repos */
  repo: string;
};

export const PACKAGES: PackageRef[] = [
  { name: "math", command: "mcp-go-math", repo: "mcp-go-math" },
  { name: "google-search", command: "mcp-gemini-google-search", repo: "mcp-gemini-search" },
  { name: "google", command: "google-mcp", repo: "google-mcp" },
  { name: "strava", command: "strava-mcp", repo: "go-strava-mcp" },
  { name: "garmin", command: "garmin", repo: "go-garmin" },
  { name: "feeds", command: "feeds-mcp", repo: "feeds-mcp" },
  { name: "twitter", command: "twitter-mcp", repo: "twitter-mcp" },
  { name: "maps", command: "google-maps-mcp", repo: "google-maps-mcp" },
  { name: "youtube", command: "youtube-go-mcp", repo: "youtube-go-mcp" },
  { name: "cast", command: "mcp-beam", repo: "mcp-beam" },
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
  return {
    name,
    command,
    args,
    auth_args,
    authFlow,
    envKeys,
    homeOnly: Boolean(j.home_only ?? j.homeOnly),
    blurb: String(j.blurb ?? ""),
  };
}

export function secretKeysForGrant(granted: string[], catalog: CatalogEntry[]): string[] {
  const extra = catalog.filter((c) => granted.includes(c.name)).flatMap((c) => c.envKeys);
  return [...CRANE_CORE_KEYS, ...extra];
}
