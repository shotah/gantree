import type { CatalogEntry } from "../types";

/**
 * Last-known `<binary> host-manifest` JSON. Live stdout fills args/auth;
 * env keys are unioned with this so Secrets still lists a newly required
 * var before the installed binary's host-manifest catches up. The compose
 * console has no Go and no MCP bins on PATH, so without this the Secrets
 * form would list only the crane mouth.
 */
export type HostShape = Pick<CatalogEntry, "envKeys" | "blurb">
  & Partial<Pick<CatalogEntry, "args" | "auth_args" | "authFlow" | "homeOnly" | "optionalEnvKeys">>;

export const HOST_SHAPE: Record<string, HostShape> = {
  math: { envKeys: [], blurb: "No secrets. Slim default." },
  "google-search": {
    envKeys: ["GEMINI_API_KEY"],
    optionalEnvKeys: [
      "GOOGLE_API_KEY",
      "GEMINI_MODEL",
      "GOOGLE_GENAI_USE_VERTEXAI",
      "GOOGLE_CLOUD_PROJECT",
      "GOOGLE_CLOUD_LOCATION",
    ],
    blurb: "Gemini grounding search. AI Studio: GEMINI_API_KEY or GOOGLE_API_KEY. Vertex: GOOGLE_GENAI_USE_VERTEXAI + GOOGLE_CLOUD_PROJECT. Optional: GEMINI_MODEL, GOOGLE_CLOUD_LOCATION.",
  },
  google: {
    envKeys: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    optionalEnvKeys: ["USER_GOOGLE_EMAIL", "GOOGLE_PSE_API_KEY", "GOOGLE_PSE_ENGINE_ID"],
    args: ["--preset", "everyday"],
    auth_args: ["auth"],
    authFlow: "pkce",
    blurb: "Workspace. Client id/secret, then OAuth hop. Optional: USER_GOOGLE_EMAIL. PSE search needs GOOGLE_PSE_API_KEY + GOOGLE_PSE_ENGINE_ID.",
  },
  ghealth: {
    envKeys: ["GOOGLE_HEALTH_CLIENT_ID", "GOOGLE_HEALTH_CLIENT_SECRET"],
    auth_args: ["auth"],
    authFlow: "pkce",
    blurb: "Fitbit / Pixel Watch via Google Health. Client id/secret, then OAuth hop.",
  },
  strava: {
    envKeys: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"],
    auth_args: ["auth"],
    authFlow: "pkce",
    blurb: "Client id/secret, then OAuth hop.",
  },
  garmin: {
    envKeys: ["GARMIN_EMAIL", "GARMIN_PASSWORD"],
    args: ["mcp", "--tool-tier", "core"],
    auth_args: ["login"],
    authFlow: "mfa",
    blurb: "Login + MFA paste. Do this last.",
  },
  feeds: { envKeys: ["FEEDS_USER_AGENT"], blurb: "Optional contact UA." },
  twitter: { envKeys: ["X_BEARER_TOKEN"], blurb: "One bearer token." },
  maps: { envKeys: ["GOOGLE_MAPS_API_KEY"], blurb: "Places / ETA. One Maps key." },
  youtube: {
    envKeys: ["YOUTUBE_OAUTH_CLIENT_ID", "YOUTUBE_OAUTH_CLIENT_SECRET"],
    auth_args: ["auth", "oauth"],
    authFlow: "device",
    blurb: "TV/device OAuth. After Google.",
  },
  cast: { envKeys: [], homeOnly: true, blurb: "LAN only. No secrets." },
  flights: { envKeys: ["SERPAPI_API_KEY"], blurb: "Google Flights via SerpAPI. One key." },
  rentals: { envKeys: ["RENTCAST_API_KEY"], blurb: "US listings. One RentCast key." },
  cars: { envKeys: ["MARKETCHECK_API_KEY"], blurb: "Used/new inventory. One MarketCheck key." },
};
