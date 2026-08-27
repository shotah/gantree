import { hostname as osHostname } from "node:os";
import { bindIsOpen, dbPath } from "../door/store";
import type { HostRuntime } from "../types";
import { maskEnv } from "./envfile";
import { tomlPath, yardRoot } from "./files";

const WATCH = [
  "HOST",
  "PORT",
  "DOCKER_SOCKET",
  "DOCKER_HOST",
  "GANTREE_ROOT",
  "GANTREE_TOML",
  "GANTREE_DB",
  "GANTREE_HOST_ROOT",
  "GANTREE_CRANE_USER",
  "GANTREE_TOOLS",
  "GANTREE_MCP_ROOT",
  "GANTREE_DEV",
  "GANTREE_SHOT",
] as const;

/** Process env the console is running with — no passphrases. */
export function consoleRuntime(dockerHostname?: string | null): HostRuntime {
  const env: Record<string, string> = {};
  for (const k of WATCH) {
    const v = process.env[k];
    if (v != null && v !== "") {
      env[k] = v;
    }
  }
  const host = process.env.HOST || "127.0.0.1";
  const port = process.env.PORT || "3000";
  return {
    hostname: (dockerHostname ?? "").trim() || osHostname(),
    bind: `${host}:${port}`,
    bindOpen: bindIsOpen(),
    root: yardRoot(),
    tomlPath: tomlPath(),
    dbPath: dbPath(),
    craneUser: process.env.GANTREE_CRANE_USER?.trim() || null,
    env: maskEnv(env),
  };
}
