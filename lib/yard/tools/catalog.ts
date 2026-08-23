import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "../types";
import { yardRoot } from "../host/files";
import { PACKAGES, fallbackEntry, parseHostManifest, type PackageRef } from "./packages";
import { HOST_SHAPE } from "./shape";

export {
  CRANE_CORE_KEYS,
  LIFE_CAST_GRANT,
  LIFE_GRANT,
  PACKAGES,
  SLIM_GRANT,
  envKeysForServer,
  optionalKeysForGrant,
  parseHostManifest,
  secretKeysForGrant,
  serverFromCatalog,
} from "./packages";

function mcpReposRoot(): string {
  if (process.env.GANTREE_MCP_ROOT) {
    return resolve(process.env.GANTREE_MCP_ROOT);
  }
  const here = fileURLToPath(new URL(".", import.meta.url));
  return resolve(here, "../../../repos/ai-gantry/repos");
}

function tryManifest(cmd: string, args: string[], cwd?: string, timeout = 90_000): CatalogEntry | null {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CGO_ENABLED: "0" },
    });
    return parseHostManifest(out);
  } catch {
    return null;
  }
}

function toolsDir(): string | null {
  if (process.env.GANTREE_TOOLS) {
    return resolve(process.env.GANTREE_TOOLS);
  }
  return null;
}

/** Fetched bins after tools-fetch — compose has these, not Go source. */
function tryCraneBins(pkg: PackageRef): CatalogEntry | null {
  if (process.env.VITEST) {
    return null;
  }
  const gantries = resolve(yardRoot(), "gantries");
  if (!existsSync(gantries)) {
    return null;
  }
  let slugs: string[];
  try {
    slugs = readdirSync(gantries);
  } catch {
    return null;
  }
  for (const slug of slugs) {
    const bin = resolve(gantries, slug, "data", "bin", pkg.command);
    if (!existsSync(bin)) {
      continue;
    }
    const hit = tryManifest(bin, ["host-manifest"], undefined, 8_000);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function tryRepoManifestJson(repoDir: string): CatalogEntry | null {
  const p = resolve(repoDir, "host-manifest.json");
  if (!existsSync(p)) {
    return null;
  }
  try {
    return parseHostManifest(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function withShape(pkg: PackageRef, live: CatalogEntry | null): CatalogEntry {
  const known = HOST_SHAPE[pkg.name];
  const base = live ?? fallbackEntry(pkg);
  const merged: CatalogEntry = known
    ? {
        ...known,
        ...base,
        envKeys: base.envKeys.length ? base.envKeys : known.envKeys,
        optionalEnvKeys: base.optionalEnvKeys?.length ? base.optionalEnvKeys : known.optionalEnvKeys,
        blurb: base.blurb || known.blurb,
        args: base.args ?? known.args,
        auth_args: base.auth_args ?? known.auth_args,
        authFlow: base.authFlow ?? known.authFlow,
        homeOnly: base.homeOnly ?? known.homeOnly,
      }
    : base;
  return {
    ...merged,
    download_tag: merged.download_tag || pkg.downloadTag,
    // Yard PACKAGES win for google-search so a leftover zchee binary cannot redirect tools-fetch.
    download_url:
      pkg.name === "google-search" ? pkg.downloadUrl || merged.download_url : merged.download_url || pkg.downloadUrl,
  };
}

function discover(pkg: PackageRef): CatalogEntry {
  const fromPath = tryManifest(pkg.command, ["host-manifest"]);
  const tools = toolsDir();
  const fromTools = !fromPath && tools ? tryManifest(resolve(tools, pkg.command), ["host-manifest"]) : null;
  const fromBins = !fromPath && !fromTools ? tryCraneBins(pkg) : null;
  const repoDir = resolve(mcpReposRoot(), pkg.repo);
  const fromGo =
    !fromPath && !fromTools && !fromBins && existsSync(repoDir)
      ? tryManifest("go", ["run", ".", "host-manifest"], repoDir)
      : null;
  const fromJson = !fromPath && !fromTools && !fromBins && !fromGo ? tryRepoManifestJson(repoDir) : null;
  return withShape(pkg, fromPath ?? fromTools ?? fromBins ?? fromGo ?? fromJson);
}

let cached: CatalogEntry[] | null = null;

/** List from PACKAGES; keys/auth from each binary's host-manifest (shape if it cannot run). */
export function loadCatalog(): CatalogEntry[] {
  if (!cached) {
    cached = PACKAGES.map(discover);
  }
  return cached;
}
