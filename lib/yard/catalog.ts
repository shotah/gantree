import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES, fallbackEntry, parseHostManifest, type PackageRef } from "./packages";
import type { CatalogEntry } from "./types";

export {
  CRANE_CORE_KEYS,
  LIFE_CAST_GRANT,
  LIFE_GRANT,
  PACKAGES,
  SLIM_GRANT,
  parseHostManifest,
  secretKeysForGrant,
} from "./packages";

function mcpReposRoot(): string {
  if (process.env.GANTREE_MCP_ROOT) {
    return resolve(process.env.GANTREE_MCP_ROOT);
  }
  const here = fileURLToPath(new URL(".", import.meta.url));
  return resolve(here, "../../repos/ai-gantry/repos");
}

function tryManifest(cmd: string, args: string[], cwd?: string): CatalogEntry | null {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout: 90_000,
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

function discover(pkg: PackageRef): CatalogEntry {
  const fromPath = tryManifest(pkg.command, ["host-manifest"]);
  const tools = toolsDir();
  const fromTools = !fromPath && tools ? tryManifest(resolve(tools, pkg.command), ["host-manifest"]) : null;
  const repoDir = resolve(mcpReposRoot(), pkg.repo);
  const fromGo =
    !fromPath && !fromTools && existsSync(repoDir)
      ? tryManifest("go", ["run", ".", "host-manifest"], repoDir)
      : null;
  const shape = fromPath ?? fromTools ?? fromGo ?? fallbackEntry(pkg);
  return {
    ...shape,
    download_tag: shape.download_tag || pkg.downloadTag,
    download_url: shape.download_url || pkg.downloadUrl,
  };
}

let cached: CatalogEntry[] | null = null;

/** List from PACKAGES; keys/auth from each binary's host-manifest. */
export function loadCatalog(): CatalogEntry[] {
  if (!cached) {
    cached = PACKAGES.map(discover);
  }
  return cached;
}
