/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyTrajectory } from "@/lib/yard/observe/spend";
import type { SpendRollup, YardInventory, YardSpend } from "@/lib/yard/types";
import { card } from "../../test/yard/card";
import { YardBoard } from "./YardBoard";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

vi.mock("./DoorShell", () => ({
  useDoor: vi.fn(() => ({ ready: true, operator: { id: "1", name: "kit", displayName: "Kit", role: "admin", cranes: [], avatarRev: null } })),
}));

import { yardFetch } from "../lib/yardFetch";

afterEach(() => {
  cleanup();
});

function crane(partial: Partial<SpendRollup> & Pick<SpendRollup, "slug">): SpendRollup {
  return {
    turns: 1,
    promptEst: 80,
    genEst: 20,
    estTokens: 100,
    lastAt: Date.now() - 120_000,
    byUser: [],
    bySource: [{ id: "user", turns: 1, estTokens: 100 }],
    unattributedTurns: 0,
    lastTurn: { at: Date.now() - 120_000, source: "user", outcome: "ok", estTokens: 100, rounds: 1 },
    trajectory: emptyTrajectory(),
    ...partial,
  };
}

function inventory(over: Partial<YardInventory> = {}): YardInventory {
  const spend: YardSpend = {
    turns: 1,
    promptEst: 80,
    genEst: 20,
    estTokens: 100,
    lastAt: Date.now() - 120_000,
    lastTurn: { at: Date.now() - 120_000, source: "user", outcome: "ok", estTokens: 100, rounds: 1 },
    bySource: [{ id: "user", turns: 1, estTokens: 100 }],
    trajectory: { ...emptyTrajectory(), recoveries: 2 },
    sampledAt: Date.now(),
    cranes: [crane({ slug: "kit", trajectory: { ...emptyTrajectory(), recoveries: 2 } })],
  };
  return {
    source: "gantree.toml",
    yard: "home",
    gantries: [card({ lastTurn: new Date(Date.now() - 120_000).toISOString() })],
    dockerError: null,
    host: { live: null, spark: [] },
    canBuild: false,
    spend,
    ...over,
  };
}

describe("YardBoard", () => {
  it("shows last-turn age and a recovery spark when recoveries exist", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return { ok: true, json: async () => inventory() } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("kit")).toBeTruthy());
    expect(screen.getByText("2m ago")).toBeTruthy();
    expect(screen.getByLabelText("2 recoveries")).toBeTruthy();
  });

  it("omits the recovery spark when the crane has none", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return { ok: true, json: async () => inventory({ spend: undefined }) } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("kit")).toBeTruthy());
    expect(screen.queryByLabelText(/recoveries/)).toBeNull();
  });

  it("shows data-dir size on the card when the dir is fat", async () => {
    const fat = 300 * 1024 * 1024;
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return {
        ok: true,
        json: async () =>
          inventory({
            sparks: {
              kit: [
                {
                  at: Date.now(),
                  cpuPercent: 1,
                  memBytes: 1,
                  memLimitBytes: 2,
                  diskBytes: fat,
                },
              ],
            },
          }),
      } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("300 MiB")).toBeTruthy());
    expect(screen.getByText("data dir")).toBeTruthy();
  });

  it("paints host chrome before the gantries fetch returns", () => {
    vi.mocked(yardFetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return Promise.resolve({ ok: true, json: async () => ({ events: [] }) } as Response);
      }
      return new Promise(() => undefined);
    });
    render(<YardBoard />);
    expect(screen.getByText("Shipping yard")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Host/ })).toBeTruthy();
    expect(screen.getByText(/Sampling Docker/)).toBeTruthy();
    expect(screen.queryByText("Talking to Docker…")).toBeNull();
  });

  it("shows toml cards while docker is still pending", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return { ok: true, json: async () => inventory({ dockerPending: true }) } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("kit")).toBeTruthy());
    expect(screen.getByText(/checking Docker/)).toBeTruthy();
  });

  it("does not show the empty-yard hint while docker is still pending", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return { ok: true, json: async () => inventory({ gantries: [], dockerPending: true }) } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText(/checking Docker/)).toBeTruthy());
    expect(screen.queryByText(/No cranes yet/)).toBeNull();
  });
});
