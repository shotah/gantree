/** `gantry status` JSON. `"ok":false` must not be regex-matched as healthy. */
export type GantryStatusJson = {
  alive?: boolean;
  ok?: boolean;
  reason?: string;
  channel?: string;
  /** Harness semver from the binary. Compose `:latest` is not this. */
  version?: string;
  /** Short git sha when the image was built (`none` omitted). */
  commit?: string;
  mcp?: {
    listed?: number;
    connected?: number;
    skipped?: number;
    servers?: Array<{
      name?: string;
      state?: string;
      reason?: string;
      note?: string;
      auth?: boolean;
    }>;
  };
};

export function parseGantryStatusJson(text: string): GantryStatusJson | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const j: unknown = JSON.parse(text.slice(start, end + 1));
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      return null;
    }
    const rec = j as Record<string, unknown>;
    if (typeof rec.alive !== "boolean" && typeof rec.ok !== "boolean") {
      return null;
    }
    return rec as GantryStatusJson;
  } catch {
    return null;
  }
}

export function shortImageId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const hex = raw.trim().replace(/^sha256:/, "");
  return hex.length <= 12 ? hex : hex.slice(0, 12);
}

export function fmtGantryBuild(g: {
  version?: string | null;
  commit?: string | null;
  imageId?: string | null;
}): string | null {
  const version = g.version?.trim() || null;
  const commit = cleanCommit(g.commit);
  if (version && commit) {
    return `${version} · ${commit}`;
  }
  return version ?? commit ?? g.imageId ?? null;
}

function cleanCommit(raw: string | null | undefined): string | null {
  const c = raw?.trim();
  if (!c || c.toLowerCase() === "none") {
    return null;
  }
  return c;
}

function semverParts(v: string): [number, number, number] | null {
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function cmpGantryVersion(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  if (!pa && !pb) {
    return a.localeCompare(b);
  }
  if (!pa) {
    return -1;
  }
  if (!pb) {
    return 1;
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

export function newestGantryVersion(versions: Array<string | null | undefined>): string | null {
  const found = versions.filter((v): v is string => typeof v === "string" && semverParts(v) != null);
  if (found.length === 0) {
    return null;
  }
  return found.reduce((best, v) => (cmpGantryVersion(v, best) > 0 ? v : best));
}

/** True when `newest` is a real semver and this crane is missing or older. */
export function gantryBehind(version: string | null | undefined, newest: string | null | undefined): boolean {
  if (!newest || !semverParts(newest)) {
    return false;
  }
  if (!version || !semverParts(version)) {
    return true;
  }
  return cmpGantryVersion(version, newest) < 0;
}
