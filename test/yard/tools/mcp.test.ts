import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stringifyMcpToml } from "@/lib/yard/host/files";

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    { name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." },
    { name: "google", command: "google-mcp", auth_args: ["auth"], envKeys: [], blurb: "Gmail." },
  ],
}));

import { mcpHint, mcpSnapshot } from "@/lib/yard/tools/mcp";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("mcpSnapshot", () => {
  it("counts google as skipped until an oauth session file exists", () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
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

describe("mcpHint", () => {
  it("is silent with zero grants and names skips", () => {
    expect(mcpHint({ listed: 0, published: 0, skipped: 0, skippedNames: [] })).toBeNull();
    expect(mcpHint({ listed: 2, published: 2, skipped: 0, skippedNames: [] })).toBe("2 published");
    expect(mcpHint({ listed: 2, published: 1, skipped: 1, skippedNames: ["google"] })).toContain("google");
  });
});
