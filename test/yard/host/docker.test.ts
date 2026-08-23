import { afterEach, describe, expect, it } from "vitest";
import {
  bindDest,
  cpuMemFromStats,
  craneRuntime,
  craneUser,
  dockerErrorMessage,
  hostBindPath,
  looksLikeGantry,
  mergeBinds,
  normalizeName,
  ownerUserSpec,
  stateOf,
  usableUserSpec,
} from "@/lib/yard/host/docker";

describe("looksLikeGantry", () => {
  it("matches hub and local gantry images", () => {
    expect(looksLikeGantry("shotah/ai-gantry:latest", ["kit"])).toBe(true);
    expect(looksLikeGantry("gantry:local", ["gantry"])).toBe(true);
  });

  it("skips the console itself", () => {
    expect(looksLikeGantry("gantree:local", ["gantree"])).toBe(false);
  });
});

describe("normalizeName", () => {
  it("strips the docker slash", () => {
    expect(normalizeName("/kit")).toBe("kit");
  });
});

describe("stateOf", () => {
  it("maps known states", () => {
    expect(stateOf("running")).toBe("running");
    expect(stateOf("weird")).toBe("unknown");
    expect(stateOf("restarting")).toBe("restarting");
    expect(stateOf("restarting", { running: true })).toBe("running");
    expect(stateOf("running", { paused: true })).toBe("paused");
  });
});

describe("craneUser", () => {
  it("keeps a host uid from inspect", () => {
    expect(craneUser("1000:1000")).toBe("1000:1000");
  });

  it("drops distroless nonroot so host-owned data/ stays writable", () => {
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    if (uid == null || gid == null || uid === 0) {
      expect(craneUser("65532:65532")).toBeUndefined();
      return;
    }
    expect(craneUser("65532:65532")).toBe(`${uid}:${gid}`);
    expect(craneUser("")).toBe(`${uid}:${gid}`);
    expect(craneUser("nonroot")).toBe(`${uid}:${gid}`);
  });

  it("uses GANTREE_CRANE_USER when the console is root-in-docker", () => {
    const prev = process.env.GANTREE_CRANE_USER;
    process.env.GANTREE_CRANE_USER = "1000:1000";
    expect(craneUser("65532:65532")).toBe("1000:1000");
    if (prev === undefined) {
      delete process.env.GANTREE_CRANE_USER;
    } else {
      process.env.GANTREE_CRANE_USER = prev;
    }
  });

  it("ignores root and nobody specs", () => {
    expect(usableUserSpec("0:0")).toBeUndefined();
    expect(usableUserSpec("root")).toBeUndefined();
    expect(usableUserSpec("65534:65534")).toBeUndefined();
    expect(usableUserSpec("65532:65532")).toBeUndefined();
  });
});

describe("ownerUserSpec", () => {
  it("uses the first path owned by a real login", () => {
    const stat = (p: string) => {
      if (p.endsWith("gantry.db")) {
        return { uid: 65532, gid: 65532 };
      }
      if (p.endsWith("data")) {
        return { uid: 0, gid: 0 };
      }
      if (p.endsWith("mcp.toml")) {
        return { uid: 1000, gid: 1000 };
      }
      throw new Error("missing");
    };
    expect(ownerUserSpec(["/app/gantries/kit/data/gantry.db", "/app/gantries/kit/data", "/app/gantries/kit/mcp.toml"], stat)).toBe(
      "1000:1000",
    );
  });
});

describe("mergeBinds", () => {
  it("keeps extra host binds and replaces dest collisions", () => {
    expect(
      mergeBinds(
        ["/opt/agents/kit/data:/data", "/opt/agents/kit/persona:/persona"],
        ["/old/data:/data", "/dev/snd:/dev/snd"],
      ),
    ).toEqual(["/opt/agents/kit/data:/data", "/opt/agents/kit/persona:/persona", "/dev/snd:/dev/snd"]);
  });
});

describe("dockerErrorMessage", () => {
  it("maps socket errors", () => {
    expect(dockerErrorMessage(new Error("EACCES permission denied"))).toMatch(/docker group/);
    expect(dockerErrorMessage(new Error("ENOENT"))).toMatch(/socket not found/);
    expect(dockerErrorMessage(new Error("boom"))).toBe("boom");
    expect(dockerErrorMessage("raw")).toBe("raw");
  });
});

describe("cpuMemFromStats", () => {
  it("computes cpu percent when system delta is positive", () => {
    const out = cpuMemFromStats({
      cpu_stats: { cpu_usage: { total_usage: 30 }, system_cpu_usage: 200, online_cpus: 4 },
      precpu_stats: { cpu_usage: { total_usage: 10 }, system_cpu_usage: 100 },
      memory_stats: { usage: 1, limit: 2 },
    });
    expect(out.cpuPercent).toBeCloseTo(80);
    expect(out.memBytes).toBe(1);
  });

  it("leaves cpu null when system delta is zero", () => {
    expect(cpuMemFromStats({}).cpuPercent).toBeNull();
  });
});

describe("bindDest and craneRuntime", () => {
  it("reads dest from a bind and keeps extra runtime bits", () => {
    expect(bindDest("/host/data:/data:ro")).toBe("/data");
    expect(bindDest("/dev/snd")).toBe("/dev/snd");
    const rt = craneRuntime({
      Config: { User: "1000:1000", Labels: { "gantree.slug": "kit" } },
      HostConfig: { NetworkMode: "host", Binds: ["/dev/snd:/dev/snd"], GroupAdd: ["audio", ""] },
    });
    expect(rt.user).toBe("1000:1000");
    expect(rt.networkMode).toBe("host");
    expect(rt.groupAdd).toEqual(["audio"]);
    expect(rt.labels["gantree.slug"]).toBe("kit");
    expect(craneRuntime({ HostConfig: { NetworkMode: "default" } }).networkMode).toBeUndefined();
  });
});

describe("hostBindPath", () => {
  const prevRoot = process.env.GANTREE_ROOT;
  const prevHost = process.env.GANTREE_HOST_ROOT;

  afterEach(() => {
    if (prevRoot === undefined) {
      delete process.env.GANTREE_ROOT;
    } else {
      process.env.GANTREE_ROOT = prevRoot;
    }
    if (prevHost === undefined) {
      delete process.env.GANTREE_HOST_ROOT;
    } else {
      process.env.GANTREE_HOST_ROOT = prevHost;
    }
  });

  it("rewrites /app inventory paths to the host checkout", () => {
    process.env.GANTREE_ROOT = "/app";
    process.env.GANTREE_HOST_ROOT = "/opt/gantree";
    expect(hostBindPath("/app/gantries/kit/mcp.toml")).toBe("/opt/gantree/gantries/kit/mcp.toml");
    expect(hostBindPath("/app/gantries/kit/data")).toBe("/opt/gantree/gantries/kit/data");
  });

  it("leaves absolute attach paths and already-host paths alone", () => {
    process.env.GANTREE_ROOT = "/app";
    process.env.GANTREE_HOST_ROOT = "/opt/gantree";
    expect(hostBindPath("/opt/agents/kit/data")).toBe("/opt/agents/kit/data");
    expect(hostBindPath("/opt/gantree/gantries/kit/data")).toBe("/opt/gantree/gantries/kit/data");
  });

  it("is identity when GANTREE_HOST_ROOT is unset", () => {
    process.env.GANTREE_ROOT = "/app";
    delete process.env.GANTREE_HOST_ROOT;
    expect(hostBindPath("/app/gantries/kit/mcp.toml")).toBe("/app/gantries/kit/mcp.toml");
  });
});
