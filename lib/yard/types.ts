export type GantryState = "running" | "exited" | "created" | "paused" | "restarting" | "dead" | "unknown";

/** Hub pin for new cranes. Bump when a release is known-good. `:latest` moves. */
export const DEFAULT_IMAGE = "shotah/ai-gantry:0.1.66";

export type GantryCard = {
  slug: string;
  containerName: string;
  containerId: string | null;
  image: string | null;
  state: GantryState;
  health: string | null;
  startedAt: string | null;
  restartCount: number | null;
  model: string | null;
  channel: string | null;
  lastError: string | null;
  lastTurn: string | null;
  mcpListed: number;
  mcpPublished: number;
  mcpSkipped: number;
  mcpHint: string | null;
  dataDir: string | null;
  personaDir: string | null;
  mcpManifest: string | null;
  envFile: string | null;
};

export type LogLine = {
  ts: string | null;
  level: string | null;
  msg: string;
  raw: string;
  json: Record<string, unknown> | null;
  kind: "error" | "skip" | "tool" | "turn" | "info";
  turnId: string | null;
};

export type LogTurnGroup = {
  turnId: string | null;
  lines: LogLine[];
};

export type StatSample = {
  at: number;
  cpuPercent: number | null;
  memBytes: number | null;
  memLimitBytes: number | null;
};

export type TurnSample = {
  at: number;
  rounds: number | null;
  recoveries: number | null;
  estTokens: number | null;
};

export type McpSample = {
  at: number;
  published: number;
  skipped: number;
};

export type UptimeSample = {
  at: number;
  uptimeSeconds: number | null;
  restartCount: number | null;
};

export type McpSnapshot = {
  listed: number;
  published: number;
  skipped: number;
  skippedNames: string[];
};

export type DoctorCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type DoctorReport = {
  slug: string;
  ok: boolean;
  checks: DoctorCheck[];
};

export type McpServer = {
  name: string;
  command?: string;
  args?: string[];
  auth_args?: string[];
  download_tag?: string;
  download_url?: string;
  tools?: string[];
  exclude?: string[];
  force?: boolean;
};

export type AuthFlow = "pkce" | "device" | "mfa";

export type CatalogEntry = {
  name: string;
  command: string;
  args?: string[];
  auth_args?: string[];
  authFlow?: AuthFlow;
  download_tag?: string;
  download_url?: string;
  envKeys: string[];
  homeOnly?: boolean;
  blurb: string;
};

export type YardInventory = {
  source: "gantree.toml" | "docker-discover";
  yard: string;
  gantries: GantryCard[];
  dockerError: string | null;
  /** CPU samples for board sparklines — filled by the list API, not listYard. */
  sparks?: Record<string, StatSample[]>;
};
