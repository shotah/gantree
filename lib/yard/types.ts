export type GantryState = "running" | "exited" | "created" | "paused" | "restarting" | "dead" | "unknown";

/** Board badge — files + docker state, never a fake-green. */
export type CraneNagKind = "dead" | "skipped" | "auth";
export type CraneNag = { kind: CraneNagKind; detail: string };

/** Hub image for new cranes. One pin: `:latest`. Do not sprinkle semver. */
export const DEFAULT_IMAGE = "shotah/ai-gantry:latest";

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
  /** Skipped MCP / needs-auth / dead process — visible on the yard home. */
  nags: CraneNag[];
  dataDir: string | null;
  personaDir: string | null;
  mcpManifest: string | null;
  envFile: string | null;
  /** mtime of persona/avatar.jpg (or png/webp). Null if none. */
  avatarRev: number | null;
  /** True when this session may mutate the crane — filled by the get API. */
  canMutate?: boolean;
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
  key: string;
  rounds: number | null;
  recoveries: number | null;
  /** prompt_est_tokens + gen_est_tokens (chars/4). Null if the line had no token fields. */
  estTokens: number | null;
  promptEstTokens: number | null;
  genEstTokens: number | null;
  source: string | null;
  userId: string | null;
  sessionId: string | null;
  outcome: string | null;
};

export type SpendSlice = {
  id: string;
  turns: number;
  estTokens: number;
};

export type SpendRollup = {
  slug: string;
  turns: number;
  promptEst: number;
  genEst: number;
  estTokens: number;
  lastAt: number | null;
  byUser: SpendSlice[];
  bySource: SpendSlice[];
  unattributedTurns: number;
};

export type YardSpend = {
  turns: number;
  promptEst: number;
  genEst: number;
  estTokens: number;
  cranes: SpendRollup[];
};

export type YardEvent = {
  id: number;
  at: string;
  kind: string;
  slug: string | null;
  operatorId: string | null;
  operatorName: string | null;
  detail: string;
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
  /** Granted servers whose oauth session file is missing (subset of skipped). */
  authMissing: string[];
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
  /** Est. token spend from JSON slog — filled by the list API, not listYard. */
  spend?: YardSpend;
  /** True when this session may build a crane — filled by the list API. */
  canBuild?: boolean;
};
