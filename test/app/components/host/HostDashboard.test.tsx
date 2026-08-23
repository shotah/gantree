/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostDashboard } from "@/app/components/host/HostDashboard";
import type { HostSnapshot } from "@/lib/yard/types";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

class FakeEventSource {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  static instances: FakeEventSource[] = [];
}

const live: HostSnapshot = {
  at: Date.now() - 5_000,
  hostname: "paddleboy",
  ncpu: 4,
  memTotalBytes: 16 * 1024 ** 3,
  craneCpu: 80,
  consoleCpu: 20,
  otherCpu: 10,
  craneMem: 2 * 1024 ** 3,
  consoleMem: 200 * 1024 ** 2,
  otherMem: 50 * 1024 ** 2,
  craneRx: 5 * 1024 ** 2,
  craneTx: 1024 ** 2,
  consoleRx: 200_000,
  consoleTx: 50_000,
  otherRx: 1024 ** 2,
  otherTx: 100_000,
  procs: [{ name: "gantry-tim", role: "crane", cpuPercent: 40, memBytes: 800 * 1024 ** 2, netRxBytes: 5 * 1024 ** 2, netTxBytes: 1024 ** 2 }],
};

function json(data: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, json: async () => data } as Response);
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(yardFetch).mockImplementation((input) => {
    const u = String(input);
    if (u.startsWith("/api/host/files")) {
      return json({ toml: 'yard = "home"\n', tomlPath: "/tmp/gantree.toml", compose: "services:\n  gantree: {}\n", composePath: "/tmp/compose.yml" });
    }
    if (u.startsWith("/api/host/db")) {
      return json({
        path: "/tmp/gantree.db",
        sizeBytes: 4096,
        journal: "wal",
        tables: [{ name: "operator", rows: 1 }, { name: "sample_machine", rows: 3 }],
      });
    }
    if (u.startsWith("/api/host/logs")) {
      return json({ error: "console is this process — no gantree container to tail" });
    }
    if (u.startsWith("/api/host")) {
      return json({
        host: { live, spark: [live, { ...live, at: live.at + 15_000, craneRx: live.craneRx + 150_000, craneTx: live.craneTx + 40_000 }] },
        dockerError: null,
        yard: "home",
        source: "gantree.toml",
        canMutate: true,
        runtime: {
          hostname: "paddleboy",
          bind: "127.0.0.1:3060",
          bindOpen: false,
          root: "/tmp",
          tomlPath: "/tmp/gantree.toml",
          dbPath: "/tmp/gantree.db",
          craneUser: null,
          env: {
            HOST: { set: true, secret: false, value: "127.0.0.1" },
            LLM_API_KEY: { set: true, secret: true, value: "" },
            TELEGRAM_BOT_TOKEN: { set: false, secret: true, value: "" },
          },
        },
      });
    }
    if (u.startsWith("/api/events")) {
      return json({ events: [] });
    }
    return json({});
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HostDashboard", () => {
  it("mirrors the crane page: metrics, inventory, sqlite", async () => {
    render(<HostDashboard />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "paddleboy" })).toBeTruthy());
    expect(screen.getByText("NET")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("CPU % of host")).toBeTruthy());
    expect(screen.getByText(/16\.0 GiB · home/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "← shipping yard" })).toHaveProperty("href", expect.stringMatching(/\/$/));

    fireEvent.click(screen.getByRole("button", { name: /Inventory/ }));
    await waitFor(() => expect(screen.getByDisplayValue(/yard = "home"/)).toBeTruthy());
    expect(screen.getByText(/This file is the yard/)).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save gantree.toml" });
    expect(save).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I am rewriting gantree.toml/ }));
    expect(save).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: /Sqlite/ }));
    await waitFor(() => expect(screen.getByText("sample_machine")).toBeTruthy());
  });

  it("hides toml and sqlite from a non-admin", async () => {
    vi.mocked(yardFetch).mockImplementation((input) => {
      const u = String(input);
      if (u.startsWith("/api/host") && !u.includes("/api/host/")) {
        return json({
          host: { live, spark: [] },
          dockerError: null,
          yard: "home",
          source: "gantree.toml",
          canMutate: false,
          runtime: null,
        });
      }
      if (u.startsWith("/api/events")) {
        return json({ events: [] });
      }
      return json({});
    });
    render(<HostDashboard />);
    await waitFor(() => expect(screen.getByText(/read only/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Inventory/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sqlite/ })).toBeNull();
  });

  it("dots set process secrets and highlights empty ones", async () => {
    render(<HostDashboard />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "paddleboy" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Runtime/ }));
    await waitFor(() => expect(screen.getByText("HOST")).toBeTruthy());
    expect(screen.getByText("127.0.0.1")).toBeTruthy();
    expect(screen.getByText("••••••••")).toBeTruthy();
    expect(screen.getByText("needs a key")).toBeTruthy();
  });
});
