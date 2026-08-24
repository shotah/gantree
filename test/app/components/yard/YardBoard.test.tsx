/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyTrajectory } from "@/lib/yard/observe/spend";
import type { SpendRollup, YardInventory, YardSpend } from "@/lib/yard/types";
import { card } from "@/test/yard/card";
import { BOARD_ORDER_KEY, HOST_CARD_ID } from "@/app/lib/boardOrder";
import { YardBoard } from "@/app/components/yard/YardBoard";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

vi.mock("@/app/components/shared/DoorShell", () => ({
  useDoor: vi.fn(() => ({ ready: true, operator: { id: "1", name: "kit", displayName: "Kit", role: "admin", cranes: [], avatarRev: null } })),
}));

import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  cleanup();
  localStorage.clear();
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
    expect(screen.getByText("kit").closest("a")?.className).toMatch(/min-w-0/);
    expect(screen.getByText("kit").closest("a")?.className).toMatch(/min-h-56/);
    expect(screen.getByText("kit").closest("a")?.className).toMatch(/h-full/);
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

  it("shows colored chips and filters the board by tag", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return {
        ok: true,
        json: async () =>
          inventory({
            gantries: [
              card({ slug: "kit", tags: ["home"] }),
              card({ slug: "tryout", tags: ["guest"] }),
            ],
            tagColors: { home: "red", guest: "green" },
          }),
      } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("tryout")).toBeTruthy());
    const bar = screen.getByRole("group", { name: "Filter by tag" });
    expect(within(bar).getByRole("button", { name: "home" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "guest" })).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: "home" }));
    expect(screen.getByText("kit")).toBeTruthy();
    expect(screen.queryByText("tryout")).toBeNull();
    fireEvent.click(within(bar).getByRole("button", { name: "home" }));
    expect(screen.getByText("tryout")).toBeTruthy();
  });
  it("fills the page column with as many card tracks as fit, not a fixed 3-col grid", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return { ok: true, json: async () => inventory() } as Response;
    });
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("kit")).toBeTruthy());
    const lane = screen.getByRole("list", { name: "Yard cards" });
    expect(lane.className).toMatch(/auto-fill/);
    expect(lane.className).toMatch(/minmax\(18rem/);
    expect(lane.className).not.toMatch(/items-start/);
    expect(lane.className).not.toMatch(/grid-cols-3/);
  });

  it("pins host first and reorders only cranes", async () => {
    localStorage.setItem(BOARD_ORDER_KEY, JSON.stringify(["tryout", HOST_CARD_ID, "kit"]));
    vi.mocked(yardFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/events")) {
        return { ok: true, json: async () => ({ events: [] }) } as Response;
      }
      return {
        ok: true,
        json: async () =>
          inventory({
            gantries: [card({ slug: "kit" }), card({ slug: "tryout" })],
          }),
      } as Response;
    });
    const { unmount } = render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("tryout")).toBeTruthy());
    const lane = screen.getByRole("list", { name: "Yard cards" });
    const hrefs = () => [...lane.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs()).toEqual(["/host", "/gantries/tryout", "/gantries/kit"]);

    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (type: string, value: string) => {
        store[type] = value;
      },
      getData: (type: string) => store[type] ?? "",
      effectAllowed: "move",
      dropEffect: "move",
    };
    const kit = lane.querySelector("[data-board-id='kit']");
    const tryout = lane.querySelector("[data-board-id='tryout']");
    const host = lane.querySelector("[data-board-id='" + HOST_CARD_ID + "']");
    expect(kit).toBeTruthy();
    expect(tryout).toBeTruthy();
    expect(host).toBeTruthy();
    expect(host?.getAttribute("draggable")).toBeNull();
    fireEvent.dragStart(kit!, { dataTransfer });
    fireEvent.dragOver(tryout!, { dataTransfer });
    fireEvent.drop(tryout!, { dataTransfer });
    expect(hrefs()).toEqual(["/host", "/gantries/kit", "/gantries/tryout"]);
    expect(JSON.parse(localStorage.getItem(BOARD_ORDER_KEY) ?? "[]")).toEqual(["kit", "tryout"]);

    unmount();
    render(<YardBoard />);
    await waitFor(() => expect(screen.getByText("kit")).toBeTruthy());
    const again = screen.getByRole("list", { name: "Yard cards" });
    expect([...again.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/host",
      "/gantries/kit",
      "/gantries/tryout",
    ]);
  });
});
