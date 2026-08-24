import { DEFAULT_IMAGE, type GantryCard } from "@/lib/yard/types";

/** Minimal crane card for yard unit tests. */
export function card(over: Partial<GantryCard> = {}): GantryCard {
  return {
    slug: "kit",
    containerName: "kit",
    containerId: "cid",
    image: DEFAULT_IMAGE,
    state: "running",
    health: "healthy",
    startedAt: "2026-08-22T18:00:00.000Z",
    restartCount: 0,
    model: "dummy",
    channel: "telegram",
    lastError: null,
    lastTurn: null,
    mcpListed: 1,
    mcpPublished: 1,
    mcpSkipped: 0,
    mcpHint: "1 published",
    nags: [],
    dataDir: null,
    personaDir: null,
    mcpManifest: null,
    envFile: null,
    avatarRev: null,
    tags: [],
    ...over,
  };
}
