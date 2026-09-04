/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardsDashboard } from "@/app/components/boards/BoardsDashboard";
import type { BoardSnapshot } from "@/lib/yard/types";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

const filled: BoardSnapshot = {
  empty: false,
  roster: [
    { author: "maya", agentName: "Maya", userName: "Sister" },
    { author: "kit", agentName: "Kit", userName: "Chris" },
  ],
  open: [
    {
      id: "c_steps",
      title: "100k steps",
      kind: "steps",
      mode: "sum",
      target: 100000,
      windowStart: "2026-09-01",
      windowEnd: "2026-09-14",
      status: "open",
      participants: ["maya", "kit"],
      scores: [
        { author: "maya", value: 16000 },
        { author: "kit", value: 8000 },
      ],
    },
  ],
  closed: [
    {
      id: "c_old",
      title: "sleep week",
      kind: "sleep",
      mode: "average",
      target: 80,
      windowStart: "2026-08-01",
      windowEnd: "2026-08-07",
      status: "closed",
      participants: ["maya", "kit"],
      scores: [
        { author: "kit", value: 90 },
        { author: "maya", value: 80 },
      ],
      winner: "kit",
    },
  ],
  pins: [{ id: "n_pr", author: "kit", body: "Chris beat his 5k PR!", createdAt: "2026-09-03T12:00:00Z" }],
};

function json(data: unknown, ok = true): Promise<Response> {
  return Promise.resolve({ ok, json: async () => data } as Response);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  vi.mocked(yardFetch).mockReset();
});

describe("BoardsDashboard", () => {
  it("lists roster, full scores, pins, and a closed winner", async () => {
    vi.mocked(yardFetch).mockImplementation(() => json(filled));
    render(<BoardsDashboard />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Boards" })).toBeTruthy());
    expect(screen.getByRole("link", { name: /shipping yard/ })).toHaveProperty("href", expect.stringMatching(/\/$/));
    expect(screen.getByText("maya")).toBeTruthy();
    expect(screen.getByText("100k steps")).toBeTruthy();
    expect(screen.getByText("16,000")).toBeTruthy();
    expect(screen.getByText("Chris beat his 5k PR!")).toBeTruthy();
    expect(screen.getByText("sleep week")).toBeTruthy();
    expect(screen.getByText(/Chris won/)).toBeTruthy();
    const openFold = screen.getByRole("button", { name: /^Open/ }).closest("section");
    const closedFold = screen.getByRole("button", { name: /^Closed/ }).closest("section");
    expect(openFold?.textContent).toMatch(/100k steps/);
    expect(openFold?.textContent).not.toMatch(/sleep week/);
    expect(closedFold?.textContent).toMatch(/sleep week/);
    expect(closedFold?.textContent).toMatch(/Chris won/);
    fireEvent.click(screen.getByRole("button", { name: "close all" }));
    await waitFor(() => expect(screen.queryByText("100k steps")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "open all" }));
    await waitFor(() => {
      expect(screen.getByText("100k steps")).toBeTruthy();
      expect(screen.getByText("sleep week")).toBeTruthy();
    });
  });

  it("shows empty folds when the corkboard has no rows", async () => {
    vi.mocked(yardFetch).mockImplementation(() => json({ roster: [], open: [], closed: [], pins: [], empty: true }));
    render(<BoardsDashboard />);
    await waitFor(() => expect(screen.getByText(/No roster yet/)).toBeTruthy());
    expect(screen.getByText("No open challenges.")).toBeTruthy();
    expect(screen.getByText("No closed challenges.")).toBeTruthy();
    expect(screen.getByText("No pins.")).toBeTruthy();
  });

  it("surfaces a read error", async () => {
    vi.mocked(yardFetch).mockImplementation(() => json({ error: "boom" }, false));
    render(<BoardsDashboard />);
    await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
  });
});
