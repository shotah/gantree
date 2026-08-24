/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostCard } from "@/app/components/yard/HostCard";
import type { HostSnapshot } from "@/lib/yard/types";

afterEach(() => {
  cleanup();
});

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
  craneRx: 12 * 1024 ** 2,
  craneTx: 3 * 1024 ** 2,
  consoleRx: 1024 ** 2,
  consoleTx: 400_000,
  otherRx: 8 * 1024 ** 2,
  otherTx: 2 * 1024 ** 2,
  procs: [
    { name: "gantry-tim", role: "crane", cpuPercent: 40, memBytes: 800 * 1024 ** 2, netRxBytes: 12 * 1024 ** 2, netTxBytes: 3 * 1024 ** 2 },
    { name: "gantree-gantree-1", role: "console", cpuPercent: 20, memBytes: 200 * 1024 ** 2, netRxBytes: 1024 ** 2, netTxBytes: 400_000 },
    { name: "gantree-cloudflared-1", role: "other", cpuPercent: 10, memBytes: 50 * 1024 ** 2, netRxBytes: 8 * 1024 ** 2, netTxBytes: 2 * 1024 ** 2 },
  ],
};

const earlier: HostSnapshot = {
  ...live,
  at: live.at - 15_000,
  craneRx: 10 * 1024 ** 2,
  craneTx: 2 * 1024 ** 2,
  consoleRx: 900_000,
  consoleTx: 200_000,
  otherRx: 7 * 1024 ** 2,
  otherTx: 1024 ** 2,
};

describe("HostCard", () => {
  it("waits when Docker has not sampled yet", () => {
    render(<HostCard host={{ live: null, spark: [] }} />);
    expect(screen.getByText(/Sampling Docker for host CPU, RAM, and net/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Host/ })).toHaveProperty("href", expect.stringMatching(/\/host$/));
  });

  it("surfaces a Docker socket error instead of waiting forever", () => {
    render(<HostCard host={{ live: null, spark: [] }} dockerError="Cannot talk to Docker (permission denied)." />);
    expect(screen.getByText(/Cannot talk to Docker/)).toBeTruthy();
  });

  it("splits agents, dashboard, and other against host cores and RAM", () => {
    render(<HostCard host={{ live, spark: [earlier, live] }} />);
    const heading = screen.getByRole("heading", { name: "paddleboy" });
    expect(heading).toBeTruthy();
    expect(heading.querySelector("svg")).toBeTruthy();
    expect(heading.querySelector("span")?.className).toContain("rounded-full");
    expect(screen.getAllByText("agents").length).toBeGreaterThan(0);
    expect(screen.getAllByText("dashboard").length).toBeGreaterThan(0);
    expect(screen.getByText("gantry-tim")).toBeTruthy();
    expect(screen.getByText("NET")).toBeTruthy();
    expect(screen.getByText(/↓ .+\/s · ↑ .+\/s/)).toBeTruthy();
    expect(screen.getByText(/since those containers started/)).toBeTruthy();
    const card = screen.getByRole("link", { name: /paddleboy/ });
    expect(card).toHaveProperty("href", expect.stringMatching(/\/host$/));
    expect(card.className).toMatch(/min-w-0/);
    expect(card.className).toMatch(/max-w-full/);
  });
});
