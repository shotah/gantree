import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return {
    ...actual,
    listGantryContainers: vi.fn(),
    inspectByName: vi.fn(),
    containerLogsBuffer: vi.fn(),
    execStatus: vi.fn(),
  };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    { name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." },
    { name: "google", command: "google-mcp", envKeys: ["GOOGLE_ID"], auth_args: ["auth"], blurb: "Gmail." },
  ],
}));

import { containerDisplayName, getGantry, listYard, resetYardDockerCache } from "@/lib/yard/crane/inventory";
import { containerLogsBuffer, execStatus, inspectByName, listGantryContainers } from "@/lib/yard/host/docker";
import { stringifyMcpToml } from "@/lib/yard/host/files";
import { DEFAULT_IMAGE } from "@/lib/yard/types";

const dirs: string[] = [];
const prevRoot = process.env.GANTREE_ROOT;
const prevToml = process.env.GANTREE_TOML;

beforeEach(() => {
  resetYardDockerCache();
  vi.mocked(listGantryContainers).mockReset();
  vi.mocked(inspectByName).mockReset();
  vi.mocked(containerLogsBuffer).mockReset();
  vi.mocked(execStatus).mockReset();
  vi.mocked(listGantryContainers).mockResolvedValue([]);
  vi.mocked(inspectByName).mockResolvedValue(null);
  vi.mocked(containerLogsBuffer).mockResolvedValue(Buffer.from(""));
  vi.mocked(execStatus).mockResolvedValue(null);
});

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  if (prevRoot === undefined) {
    delete process.env.GANTREE_ROOT;
  } else {
    process.env.GANTREE_ROOT = prevRoot;
  }
  if (prevToml === undefined) {
    delete process.env.GANTREE_TOML;
  } else {
    process.env.GANTREE_TOML = prevToml;
  }
});

function yard(toml: string): string {
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  process.env.GANTREE_TOML = join(root, "gantree.toml");
  writeFileSync(join(root, "gantree.toml"), toml);
  return root;
}

function listed(over: Partial<{ id: string; name: string; image: string; state: "running" | "exited"; labels: Record<string, string> }> = {}) {
  return {
    id: "abc123def",
    name: "kit",
    image: DEFAULT_IMAGE,
    state: "running" as const,
    status: "Up 2 minutes",
    labels: { "gantree.slug": "kit" },
    ...over,
  };
}

describe("containerDisplayName", () => {
  it("strips the docker slash", () => {
    expect(containerDisplayName("/kit")).toBe("kit");
  });
});

describe("listYard", () => {
  it("merges gantree.toml with inspect, env fallback, and log hints", async () => {
    const root = yard(`
yard = "home"
[[gantry]]
slug = "kit"
container = "kit"
data_dir = "./gantries/kit/data"
persona_dir = "./gantries/kit/persona"
mcp_manifest = "./gantries/kit/mcp.toml"
env_file = "./gantries/kit/.env"
`);
    mkdirSync(join(root, "gantries/kit/persona"), { recursive: true });
    mkdirSync(join(root, "gantries/kit/data"), { recursive: true });
    writeFileSync(join(root, "gantries/kit/mcp.toml"), stringifyMcpToml([{ name: "math", command: "mcp-go-math" }]));
    writeFileSync(join(root, "gantries/kit/.env"), "LLM_MODEL=\nTELEGRAM_BOT_TOKEN=abc\n");
    vi.mocked(listGantryContainers).mockResolvedValue([listed()]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Config: { Image: "shotah/ai-gantry:pin", Env: ["LLM_MODEL=", "CHANNEL="] },
        State: { Status: "running", Health: { Status: "healthy" }, StartedAt: "0001-01-01T00:00:00Z" },
        RestartCount: 2,
      },
    } as never);
    vi.mocked(containerLogsBuffer).mockResolvedValue(
      Buffer.from(
        '{"time":"2026-08-22T18:00:00Z","level":"ERROR","msg":"boom"}\n{"time":"2026-08-22T18:01:00Z","msg":"turn done","turn_id":"t1"}\n',
      ),
    );

    const inv = await listYard();
    expect(inv.source).toBe("gantree.toml");
    expect(inv.yard).toBe("home");
    const g = inv.gantries[0];
    expect(g?.slug).toBe("kit");
    expect(g?.image).toBe("shotah/ai-gantry:pin");
    expect(g?.health).toBe("healthy");
    expect(g?.restartCount).toBe(2);
    expect(g?.startedAt).toBeNull();
    expect(g?.model).toBeNull();
    expect(g?.channel).toBe("telegram");
    expect(g?.lastError).toMatch(/boom/);
    expect(g?.lastTurn).toBe("2026-08-22T18:01:00Z");
    expect(g?.mcpListed).toBe(1);
    expect(await getGantry("kit")).toEqual(g);
    expect(await getGantry("nope")).toBeNull();
  });

  it("keeps Kit's last error off Jules", async () => {
    yard(`
[[gantry]]
slug = "kit"
container = "kit"
[[gantry]]
slug = "jules"
container = "jules"
`);
    vi.mocked(listGantryContainers).mockResolvedValue([
      listed({ id: "kit-id", name: "kit", labels: { "gantree.slug": "kit" } }),
      listed({ id: "jules-id", name: "jules", labels: { "gantree.slug": "jules" } }),
    ]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Config: { Image: DEFAULT_IMAGE, Env: [] },
        State: { Status: "running", StartedAt: "2026-08-22T18:00:00.000Z" },
        RestartCount: 0,
      },
    } as never);
    vi.mocked(containerLogsBuffer).mockImplementation(async (id: string) => {
      if (id === "kit-id") {
        return Buffer.from('{"time":"2026-08-22T18:00:00Z","level":"ERROR","msg":"kit boom"}\n');
      }
      return Buffer.from('{"time":"2026-08-22T18:01:00Z","level":"ERROR","msg":"jules boom"}\n');
    });

    const inv = await listYard();
    const kit = inv.gantries.find((g) => g.slug === "kit");
    const jules = inv.gantries.find((g) => g.slug === "jules");
    expect(kit?.lastError).toMatch(/kit boom/);
    expect(jules?.lastError).toMatch(/jules boom/);
    expect(kit?.lastError).not.toMatch(/jules/);
  });

  it("picks discord/slack from env keys and survives inspect/log failures", async () => {
    const root = yard(`
[[gantry]]
slug = "tryout"
container = "tryout"
data_dir = "./d"
persona_dir = "./p"
mcp_manifest = "./mcp.toml"
env_file = "./.env"
`);
    writeFileSync(join(root, "mcp.toml"), stringifyMcpToml([]));
    writeFileSync(join(root, ".env"), "DISCORD_BOT_TOKEN=x\n");
    vi.mocked(listGantryContainers).mockResolvedValue([listed({ name: "tryout", labels: { "gantree.slug": "tryout" } })]);
    vi.mocked(inspectByName).mockRejectedValue(new Error("gone"));
    vi.mocked(containerLogsBuffer).mockRejectedValue(new Error("no logs"));

    const g = (await listYard()).gantries[0];
    expect(g?.channel).toBe("discord");
    expect(g?.lastError).toBeNull();
    expect(g?.state).toBe("running");

    writeFileSync(join(root, ".env"), "SLACK_BOT_TOKEN=x\n");
    const slack = (await listYard()).gantries[0];
    expect(slack?.channel).toBe("slack");
  });

  it("discovers unlabeled toml by docker list and records docker errors", async () => {
    yard("yard = \"cloud\"\n");
    vi.mocked(listGantryContainers).mockResolvedValue([
      listed({ labels: { "gantree.slug": "found" }, name: "found" }),
    ]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Config: { Image: DEFAULT_IMAGE, Env: ["LLM_MODEL=dummy", "CHANNEL=stdio"] },
        State: { Status: "exited", StartedAt: "2026-08-22T18:00:00.000Z" },
        RestartCount: "nope",
      },
    } as never);

    const inv = await listYard();
    expect(inv.source).toBe("docker-discover");
    expect(inv.yard).toBe("cloud");
    expect(inv.gantries[0]?.slug).toBe("found");
    expect(inv.gantries[0]?.model).toBe("dummy");
    expect(inv.gantries[0]?.channel).toBe("stdio");
    expect(inv.gantries[0]?.state).toBe("exited");
    expect(inv.gantries[0]?.nags.some((n) => n.kind === "dead")).toBe(true);
    expect(inv.gantries[0]?.restartCount).toBeNull();
  });

  it("surfaces a docker socket error and an empty discover hint", async () => {
    const root = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(root);
    process.env.GANTREE_ROOT = root;
    process.env.GANTREE_TOML = join(root, "missing.toml");
    vi.mocked(listGantryContainers).mockRejectedValue(new Error("ENOENT: no socket"));
    const inv = await listYard();
    expect(inv.source).toBe("docker-discover");
    expect(inv.dockerError).toMatch(/Docker socket not found/);
    expect(inv.gantries).toEqual([]);
  });

  it("returns toml cards without waiting for docker", async () => {
    yard(`
[[gantry]]
slug = "kit"
container = "kit"
`);
    let release!: (rows: ReturnType<typeof listed>[]) => void;
    vi.mocked(listGantryContainers).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const pending = await listYard({ waitDocker: false });
    expect(pending.dockerPending).toBe(true);
    expect(pending.gantries[0]?.slug).toBe("kit");
    expect(pending.gantries[0]?.state).toBe("unknown");
    expect(pending.gantries[0]?.nags.some((n) => n.kind === "dead")).toBe(false);

    release([listed()]);
    const live = await listYard();
    expect(live.dockerPending).toBe(false);
    expect(live.gantries[0]?.state).toBe("running");
  });

  it("puts toml tags and [tag_color] on cards, dropping junk", async () => {
    yard(`
yard = "home"
[tag_color]
home = "red"
guest = "green"
nope = "pink"
[[gantry]]
slug = "kit"
container = "kit"
tags = ["home", "NOPE!", "guest"]
`);
    vi.mocked(listGantryContainers).mockResolvedValue([listed()]);
    const inv = await listYard();
    expect(inv.gantries[0]?.tags).toEqual(["home", "guest"]);
    expect(inv.tagColors).toEqual({ home: "red", guest: "green" });
  });

  it("reads harness version from gantry status and a short image id from inspect", async () => {
    yard(`
[[gantry]]
slug = "kit"
container = "kit"
`);
    vi.mocked(listGantryContainers).mockResolvedValue([listed()]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Image: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        Config: { Image: DEFAULT_IMAGE, Env: [] },
        State: { Status: "running", StartedAt: "2026-08-22T18:00:00.000Z" },
      },
    } as never);
    vi.mocked(execStatus).mockResolvedValue(
      JSON.stringify({ ok: true, alive: true, version: "1.2.0", commit: "cafebabe" }),
    );

    const g = (await listYard()).gantries[0];
    expect(g?.image).toBe(DEFAULT_IMAGE);
    expect(g?.version).toBe("1.2.0");
    expect(g?.commit).toBe("cafebabe");
    expect(g?.imageId).toBe("0123456789ab");
    expect(g?.imageBehind).toBe(false);
  });

  it("does not exec status on a stopped container but still records image id", async () => {
    yard(`
[[gantry]]
slug = "kit"
container = "kit"
`);
    vi.mocked(listGantryContainers).mockResolvedValue([listed({ state: "exited" })]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Image: "sha256:aaaaaaaaaaaabbbbbbbbbbbbccccccccccccccccddddddddddddeeeeeeeeeeee",
        Config: { Image: DEFAULT_IMAGE, Env: [] },
        State: { Status: "exited", StartedAt: "2026-08-22T18:00:00.000Z" },
      },
    } as never);

    const g = (await listYard()).gantries[0];
    expect(execStatus).not.toHaveBeenCalled();
    expect(g?.version).toBeNull();
    expect(g?.imageId).toBe("aaaaaaaaaaaa");
  });

  it("marks the older peer behind without calling Hub", async () => {
    yard(`
[[gantry]]
slug = "kit"
container = "kit"
[[gantry]]
slug = "old"
container = "old"
`);
    vi.mocked(listGantryContainers).mockResolvedValue([
      listed({ id: "kit-id", name: "kit", labels: { "gantree.slug": "kit" } }),
      listed({ id: "old-id", name: "old", labels: { "gantree.slug": "old" } }),
    ]);
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Image: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        Config: { Image: DEFAULT_IMAGE, Env: [] },
        State: { Status: "running", StartedAt: "2026-08-22T18:00:00.000Z" },
      },
    } as never);
    vi.mocked(execStatus).mockImplementation(async (id) => {
      if (id === "old-id") {
        return JSON.stringify({ ok: true, alive: true, version: "0.9.0", commit: "deadbee" });
      }
      return JSON.stringify({ ok: true, alive: true, version: "1.2.0", commit: "cafebabe" });
    });

    const inv = await listYard();
    const kit = inv.gantries.find((g) => g.slug === "kit");
    const old = inv.gantries.find((g) => g.slug === "old");
    expect(kit?.version).toBe("1.2.0");
    expect(kit?.imageBehind).toBe(false);
    expect(old?.version).toBe("0.9.0");
    expect(old?.imageBehind).toBe(true);
  });
});
