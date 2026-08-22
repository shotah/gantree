import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stringifyMcpToml } from "./files";
import { mcpHint, mcpSnapshot } from "./mcp";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("mcpSnapshot", () => {
  it("counts google as skipped until an oauth session file exists", () => {
    const root = mkdtempSync(join(import.meta.dirname, "../../.tmp-"));
    dirs.push(root);
    const mcp = join(root, "mcp.toml");
    const env = join(root, ".env");
    const data = join(root, "data");
    mkdirSync(data);
    writeFileSync(
      mcp,
      stringifyMcpToml([
        { name: "math", command: "mcp-go-math" },
        { name: "google", command: "google-mcp", auth_args: ["auth"] },
      ]),
    );
    writeFileSync(env, "GOOGLE_OAUTH_CLIENT_ID=id\nGOOGLE_OAUTH_CLIENT_SECRET=sec\n");
    const before = mcpSnapshot({ mcpManifest: mcp, envFile: env, dataDir: data });
    expect(before).toMatchObject({ listed: 2, published: 1, skipped: 1, skippedNames: ["google"] });
    expect(mcpHint(before)).toContain("skipped");
    writeFileSync(join(data, "google-oauth.json"), "{}");
    const after = mcpSnapshot({ mcpManifest: mcp, envFile: env, dataDir: data });
    expect(after).toMatchObject({ listed: 2, published: 2, skipped: 0 });
  });
});
