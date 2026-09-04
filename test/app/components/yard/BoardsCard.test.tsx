/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardsCard } from "@/app/components/yard/BoardsCard";
import type { BoardSnapshot } from "@/lib/yard/types";

afterEach(() => {
  cleanup();
});

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
  pins: [{ id: "n_pr", author: "kit", body: "Chris beat his 5k PR!" }],
};

describe("BoardsCard", () => {
  it("waits until the yard payload arrives", () => {
    render(<BoardsCard ready={false} />);
    expect(screen.getByRole("heading", { name: "Boards" })).toBeTruthy();
    expect(screen.getByText(/Reading the corkboard/)).toBeTruthy();
    const card = screen.getByText("Boards").closest("[data-shot=boards]");
    expect(card?.className).toMatch(/min-h-56/);
    expect(card?.className).toMatch(/h-full/);
  });

  it("is an empty card when the corkboard has no rows", () => {
    render(<BoardsCard ready board={{ roster: [], open: [], pins: [], empty: true }} />);
    expect(screen.getByText("Empty corkboard.")).toBeTruthy();
    expect(screen.queryByText(/100k/)).toBeNull();
  });

  it("lists roster names and open challenge scores", () => {
    render(<BoardsCard ready board={filled} />);
    expect(screen.getByTitle("maya").textContent).toMatch(/Sister/);
    expect(screen.getByTitle("kit").textContent).toMatch(/Chris/);
    expect(screen.getByText("100k steps")).toBeTruthy();
    expect(screen.getByText(/Sister 16,000 · Chris 8,000/)).toBeTruthy();
    expect(screen.getByText(/steps · 2026-09-01 → 2026-09-14/)).toBeTruthy();
    expect(screen.getByText("Chris beat his 5k PR!")).toBeTruthy();
    expect(screen.getByText(/Chris · pin/)).toBeTruthy();
  });
});
