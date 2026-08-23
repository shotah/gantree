import { describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/yard/tools/catalog";
import { CRANE_CORE_KEYS, PACKAGES, envKeysForServer, parseHostManifest, secretKeysForGrant } from "@/lib/yard/tools/packages";
import type { CatalogEntry } from "@/lib/yard/types";

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

  it("accepts envKeys/homeOnly and rejects junk", () => {
    const entry = parseHostManifest(
      'noise {"name":"cast","command":"mcp-beam","envKeys":["X"],"auth_flow":"device","home_only":true,"blurb":"tv"}',
    );
    expect(entry).toMatchObject({ name: "cast", authFlow: "device", homeOnly: true, envKeys: ["X"] });
    expect(() => parseHostManifest("no json")).toThrow(/no JSON object/);
    expect(() => parseHostManifest('{"name":""}')).toThrow(/name and command/);
  });
});

describe("PACKAGES", () => {
  it("is the full yard menu (grant is still that crane’s mcp.toml)", () => {
    const byName = Object.fromEntries(PACKAGES.map((p) => [p.name, p]));
    expect(byName.ghealth?.command).toBe("google-health-mcp");
    expect(byName.flights?.command).toBe("flights-search-mcp");
    expect(byName.rentals?.command).toBe("rentals-search-mcp");
    expect(byName.cars?.command).toBe("cars-search-mcp");
    expect(byName.google?.command).toBe("google-mcp");
    expect(byName.cast?.command).toBe("mcp-beam");
  });
});

describe("loadCatalog", () => {
  it("falls back to package commands without compiling nested MCP repos", () => {
    const byName = Object.fromEntries(loadCatalog().map((c) => [c.name, c]));
    expect(byName.maps?.command).toBe("google-maps-mcp");
    expect(byName.google?.command).toBe("google-mcp");
    expect(byName.cast?.download_url).toContain("mcp-beam");
  });

  it("fills env_keys and auth from last-known host-manifest when the binary cannot run", () => {
    const byName = Object.fromEntries(loadCatalog().map((c) => [c.name, c]));
    expect(byName.maps?.envKeys).toEqual(["GOOGLE_MAPS_API_KEY"]);
    expect(byName.google?.envKeys).toEqual(["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"]);
    expect(byName.google?.auth_args).toEqual(["auth"]);
    expect(byName.garmin?.envKeys).toEqual(["GARMIN_EMAIL", "GARMIN_PASSWORD"]);
    expect(byName.flights?.envKeys).toEqual(["SERPAPI_API_KEY"]);
    expect(byName.math?.envKeys).toEqual([]);
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

  it("unions mcp.toml env_keys for a custom grant", () => {
    const keys = secretKeysForGrant(["rentals"], sample, [{ name: "rentals", env_keys: ["RENTCAST_API_KEY"] }]);
    expect(keys).toContain("RENTCAST_API_KEY");
    expect(keys).not.toContain("GOOGLE_MAPS_API_KEY");
  });
});

describe("envKeysForServer", () => {
  it("prefers catalog keys and adds manifest extras", () => {
    expect(envKeysForServer({ name: "maps" }, sample)).toEqual(["GOOGLE_MAPS_API_KEY"]);
    expect(envKeysForServer({ name: "maps", env_keys: ["GOOGLE_MAPS_API_KEY", "EXTRA"] }, sample)).toEqual([
      "GOOGLE_MAPS_API_KEY",
      "EXTRA",
    ]);
  });
});
