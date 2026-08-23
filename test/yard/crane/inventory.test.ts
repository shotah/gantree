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
  };
});

vi.mock("@/lib/yard/tools/catalog", () => ({
  loadCatalog: () => [
    { name: "math", command: "mcp-go-math", envKeys: [], blurb: "Math." },
    { name: "google", command: "google-mcp", envKeys: ["GOOGLE_ID"], auth_args: ["auth"], blurb: "Gmail." },
  ],
}));

import { containerDisplayName, getGantry, listYard } from "@/lib/yard/crane/inventory";
import { containerLogsBuffer, inspectByName, listGantryContainers } from "@/lib/yard/host/docker";
import { stringifyMcpToml } from "@/lib/yard/host/files";

const dirs: string[] = [];
const prevRoot = process.env.GANTREE_ROOT;
const prevToml = process.env.GANTREE_TOML;

beforeEach(() => {
  vi.mocked(listGantryContainers).mockReset();
  vi.mocked(inspectByName).mockReset();
  vi.mocked(containerLogsBuffer).mockReset();
  vi.mocked(listGantryContainers).mockResolvedValue([]);
  vi.mocked(inspectByName).mockResolvedValue(null);
  vi.mocked(containerLogsBuffer).mockResolvedValue(Buffer.from(""));
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

function listed(over: Partial<{ id: string; name: string; image: string; state: "running"; labels: Record<string, string> }> = {}) {
  return {
    id: "abc123def",
    name: "kit",
    image: "shotah/ai-gantry:0.1.66",
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
        Config: { Image: "shotah/ai-gantry:0.1.66", Env: ["LLM_MODEL=dummy", "CHANNEL=stdio"] },
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
});
