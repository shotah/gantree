/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpendRollup, YardSpend } from "@/lib/yard/types";
import { CraneSpend, SpendBoard, SpendScope } from "./SpendBoard";

afterEach(() => {
  cleanup();
});

function crane(partial: Partial<SpendRollup> & Pick<SpendRollup, "slug">): SpendRollup {
  return {
    turns: 1,
    promptEst: 80,
    genEst: 20,
    estTokens: 100,
    lastAt: 1,
    byUser: [],
    bySource: [{ id: "user", turns: 1, estTokens: 100 }],
    unattributedTurns: 0,
    ...partial,
  };
}

const yard: YardSpend = {
  turns: 3,
  promptEst: 240,
  genEst: 60,
  estTokens: 300,
  cranes: [
    crane({
      slug: "ada",
      turns: 2,
      promptEst: 160,
      genEst: 40,
      estTokens: 200,
      byUser: [
        { id: "alice", turns: 1, estTokens: 120 },
        { id: "bob", turns: 1, estTokens: 80 },
      ],
    }),
    crane({ slug: "kit" }),
  ],
};

describe("SpendBoard", () => {
  it("starts collapsed and keeps crane ranking hidden", () => {
    render(<SpendBoard spend={yard} window="24h" onWindow={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /Est\. token spend · last 24h/ });
    expect(toggle).toHaveProperty("ariaExpanded", "false");
    expect(screen.getByText("2 cranes — expand for ranking")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "ada" })).toBeNull();
    expect(screen.queryByText("by user")).toBeNull();
  });

  it("expands to ranking and keeps per-crane users closed", () => {
    render(<SpendBoard spend={yard} window="24h" onWindow={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Est\. token spend · last 24h/ }));

    expect(screen.getByRole("button", { name: /Est\. token spend · last 24h/ })).toHaveProperty("ariaExpanded", "true");
    expect(screen.getByRole("link", { name: "ada" })).toHaveProperty("href", expect.stringMatching(/\/gantries\/ada$/));
    expect(screen.getByRole("link", { name: "kit" })).toBeTruthy();
    expect(screen.queryByText("alice")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /2 users/ }));
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
  });

  it("collapses ranking again on a second header click", () => {
    render(<SpendBoard spend={yard} window="24h" onWindow={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /Est\. token spend · last 24h/ });

    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "ada" })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "ada" })).toBeNull();
    expect(screen.getByText("2 cranes — expand for ranking")).toBeTruthy();
  });

  it("uses the window name in the empty hint without listing cranes", () => {
    render(<SpendBoard spend={undefined} window="6h" onWindow={vi.fn()} />);

    expect(screen.getByText("No turn perf in last 6h — expand for detail")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Est\. token spend · last 6h/ }));
    expect(screen.getByText(/No turn perf in last 6h\. Chat an agent/)).toBeTruthy();
  });

  it("lets window pills fire without expanding the ranking", () => {
    const onWindow = vi.fn();
    render(<SpendBoard spend={yard} window="24h" onWindow={onWindow} />);

    fireEvent.click(screen.getByRole("button", { name: "6h" }));
    expect(onWindow).toHaveBeenCalledWith("6h");
    expect(screen.queryByRole("link", { name: "ada" })).toBeNull();
  });
});

describe("SpendScope", () => {
  it("marks the active window and reports a change", () => {
    const onWindow = vi.fn();
    render(<SpendScope window="24h" onWindow={onWindow} />);

    expect(screen.getByRole("group", { name: "Time window" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(onWindow).toHaveBeenCalledWith("7d");
  });

  it("hides bucket pills until handlers are passed", () => {
    const { rerender } = render(<SpendScope window="24h" onWindow={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Token grouping" })).toBeNull();

    const onBucket = vi.fn();
    rerender(
      <SpendScope window="24h" onWindow={vi.fn()} bucket="hour" onBucket={onBucket} buckets={["cumulative", "hour"]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "/h" }));
    expect(onBucket).toHaveBeenCalledWith("hour");
  });
});

describe("CraneSpend", () => {
  it("says when the window has no turns", () => {
    render(<CraneSpend scope="last 1h" rollup={crane({ slug: "ada", turns: 0, estTokens: 0, promptEst: 0, genEst: 0 })} />);
    expect(screen.getByText("No turn perf in last 1h. Estimates are chars/4, not billed $.")).toBeTruthy();
  });

  it("shows the top user and keeps the rest behind a toggle", () => {
    render(
      <CraneSpend
        scope="last 24h"
        rollup={crane({
          slug: "ada",
          turns: 3,
          estTokens: 250,
          byUser: [
            { id: "alice", turns: 2, estTokens: 200 },
            { id: "bob", turns: 1, estTokens: 50 },
          ],
        })}
      />,
    );

    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.queryByText("bob")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /2 users/ }));
    expect(screen.getByText("bob")).toBeTruthy();
  });
});
