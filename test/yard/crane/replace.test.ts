import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yard/host/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yard/host/docker")>();
  return { ...actual, docker: vi.fn(), inspectByName: vi.fn() };
});

import { createOrReplaceContainer } from "@/lib/yard/crane/build";
import { docker, inspectByName } from "@/lib/yard/host/docker";
import { DEFAULT_IMAGE } from "@/lib/yard/types";

const dirs: string[] = [];

beforeEach(() => {
  vi.mocked(docker).mockReset();
  vi.mocked(inspectByName).mockReset();
  const root = mkdtempSync(join(process.cwd(), ".tmp-"));
  dirs.push(root);
  process.env.GANTREE_ROOT = root;
  delete process.env.GANTREE_HOST_ROOT;
});

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.GANTREE_ROOT;
});

function dockerStub(opts: {
  stop?: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
  start?: ReturnType<typeof vi.fn>;
  onCreate?: (body: Record<string, unknown>) => void;
}) {
  const stop = opts.stop ?? vi.fn().mockResolvedValue(undefined);
  const remove = opts.remove ?? vi.fn().mockResolvedValue(undefined);
  const start = opts.start ?? vi.fn().mockResolvedValue(undefined);
  vi.mocked(docker).mockReturnValue({
    getContainer: () => ({ stop, remove }),
    createContainer: async (body: Record<string, unknown>) => {
      opts.onCreate?.(body);
      return { id: "new-id", start };
    },
  } as never);
  return { stop, remove, start };
}

describe("createOrReplaceContainer", () => {
  it("keeps host user, host network, extra binds, and never publishes ports", async () => {
    let created: Record<string, unknown> | undefined;
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Id: "old-id",
        Config: { User: "1000:1000", Labels: { "gantree.slug": "kit", house: "1" } },
        HostConfig: {
          NetworkMode: "host",
          Binds: ["/opt/agents/kit/data:/data", "/dev/snd:/dev/snd"],
          GroupAdd: ["audio", ""],
        },
      },
    } as never);
    const { stop, remove, start } = dockerStub({ onCreate: (body) => (created = body) });

    const out = await createOrReplaceContainer({
      slug: "kit",
      image: DEFAULT_IMAGE,
      env: { CHANNEL: "telegram", LLM_MODEL: "dummy" },
      personaDir: "/opt/gantree/gantries/kit/persona",
      dataDir: "/opt/gantree/gantries/kit/data",
      mcpManifest: "/opt/gantree/gantries/kit/mcp.toml",
    });

    expect(out).toMatchObject({ id: "new-id", detail: expect.stringMatching(/as 1000:1000/) });
    expect(stop).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ force: true });
    expect(start).toHaveBeenCalled();
    expect(created?.User).toBe("1000:1000");
    expect(created?.OpenStdin).toBe(false);
    expect(created?.Tty).toBe(false);
    expect(created).not.toHaveProperty("ExposedPorts");
    const host = created?.HostConfig as Record<string, unknown>;
    expect(host.NetworkMode).toBe("host");
    expect(host.GroupAdd).toEqual(["audio"]);
    expect(host.PortBindings).toBeUndefined();
    expect(host.Binds).toEqual(
      expect.arrayContaining([
        "/opt/gantree/gantries/kit/persona:/persona",
        "/opt/gantree/gantries/kit/data:/data",
        "/opt/gantree/gantries/kit/mcp.toml:/etc/gantry/mcp.toml",
        `${join(dirs[0]!, "boards")}:/boards`,
        "/dev/snd:/dev/snd",
      ]),
    );
    expect(existsSync(join(dirs[0]!, "boards"))).toBe(true);
    expect(host.Binds).not.toContain("/opt/agents/kit/data:/data");
    const env = created?.Env as string[];
    expect(env).toContain("HOME=/data");
    expect(env).toContain("PATH=/data/bin:/usr/local/bin:/usr/bin:/bin");
    expect((created?.Labels as Record<string, string>)["gantree.slug"]).toBe("kit");
    expect((created?.Labels as Record<string, string>).house).toBe("1");
  });

  it("still recreates when the old container is already stopped, and opens stdin only for stdio", async () => {
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Id: "old-id",
        Config: { User: "1000:1000" },
        HostConfig: { NetworkMode: "bridge" },
      },
    } as never);
    const stop = vi.fn().mockRejectedValue(new Error("not running"));
    let created: Record<string, unknown> | undefined;
    dockerStub({ stop, onCreate: (body) => (created = body) });

    await createOrReplaceContainer({
      slug: "kit",
      image: DEFAULT_IMAGE,
      env: { CHANNEL: "stdio" },
      personaDir: "/p",
      dataDir: "/d",
      mcpManifest: "/m.toml",
    });

    expect(stop).toHaveBeenCalled();
    expect(created?.OpenStdin).toBe(true);
    expect(created?.Tty).toBe(true);
  });

  it("keeps /tools on PATH when the old crane had a fleet bin bind", async () => {
    let created: Record<string, unknown> | undefined;
    vi.mocked(inspectByName).mockResolvedValue({
      listed: {} as never,
      info: {
        Id: "old-id",
        Config: { User: "1000:1000", Env: ["PATH=/usr/local/bin:/tools", "CHANNEL=telegram"] },
        HostConfig: {
          NetworkMode: "bridge",
          Binds: ["/opt/agents/kit/bin:/tools:ro"],
        },
      },
    } as never);
    dockerStub({ onCreate: (body) => (created = body) });

    await createOrReplaceContainer({
      slug: "kit",
      image: DEFAULT_IMAGE,
      env: { CHANNEL: "telegram" },
      personaDir: "/p",
      dataDir: "/d",
      mcpManifest: "/m.toml",
    });

    const env = created?.Env as string[];
    expect(env).toContain("PATH=/data/bin:/usr/local/bin:/tools");
    const host = created?.HostConfig as Record<string, unknown>;
    expect(host.Binds).toEqual(expect.arrayContaining(["/opt/agents/kit/bin:/tools:ro"]));
  });
});
