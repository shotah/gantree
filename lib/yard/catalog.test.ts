import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "./catalog";
import { CRANE_CORE_KEYS, parseHostManifest, secretKeysForGrant } from "./packages";
import type { CatalogEntry } from "./types";

const sample: CatalogEntry[] = [
  {
    name: "maps",
    command: "google-maps-mcp",
    envKeys: ["GOOGLE_MAPS_API_KEY"],
    blurb: "Places / ETA.",
  },
  {
    name: "garmin",
    command: "garmin",
    auth_args: ["login"],
    authFlow: "mfa",
    envKeys: ["GARMIN_EMAIL", "GARMIN_PASSWORD"],
    blurb: "Login + MFA.",
  },
];

describe("parseHostManifest", () => {
  it("reads env_keys and auth_flow from binary JSON", () => {
    const entry = parseHostManifest(
      '{"name":"maps","command":"google-maps-mcp","env_keys":["GOOGLE_MAPS_API_KEY"],"blurb":"one key"}\n',
    );
    expect(entry.name).toBe("maps");
    expect(entry.envKeys).toEqual(["GOOGLE_MAPS_API_KEY"]);
    expect(entry.auth_args).toBeUndefined();
  });
});

describe("loadCatalog", () => {
  it("reads maps shape from host-manifest when the package can run", { timeout: 120_000 }, () => {
    const repo = resolve(import.meta.dirname, "../../repos/ai-gantry/repos/google-maps-mcp");
    const maps = loadCatalog().find((c) => c.name === "maps");
    expect(maps?.command).toBe("google-maps-mcp");
    if (!existsSync(repo)) {
      return;
    }
    expect(maps?.envKeys).toContain("GOOGLE_MAPS_API_KEY");
    expect(maps?.auth_args).toBeUndefined();
    expect(maps?.download_url).toContain("google-maps-mcp");
  });
});

describe("secretKeysForGrant", () => {
  it("is just the crane mouth when nothing is granted", () => {
    expect(secretKeysForGrant([], sample)).toEqual(CRANE_CORE_KEYS);
  });

  it("adds only the granted server's keys", () => {
    const keys = secretKeysForGrant(["maps"], sample);
    expect(keys).toContain("GOOGLE_MAPS_API_KEY");
    expect(keys).not.toContain("GARMIN_PASSWORD");
  });
});
