/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostCharts, MetricCharts } from "./MetricCharts";

afterEach(() => {
  cleanup();
});

describe("MetricCharts", () => {
  it("tells the operator token charts wait for a chat", () => {
    render(
      <MetricCharts host={[]} turns={[]} mcp={[]} uptime={[]} bucket="cumulative" since={null} now={Date.now()} />,
    );
    expect(screen.getByText("no turn perf in docker logs — send a chat, then refresh")).toBeTruthy();
    expect(screen.getAllByText("no samples yet — leave this page open").length).toBeGreaterThan(0);
  });

  it("charts net and blkio when Docker reported counters", () => {
    render(
      <MetricCharts
        host={[
          {
            at: 1,
            cpuPercent: 2,
            memBytes: 10,
            memLimitBytes: 20,
            netRxBytes: 2 * 1024 * 1024,
            netTxBytes: 1024 * 1024,
            blkReadBytes: 4 * 1024 * 1024,
            blkWriteBytes: 1024 * 1024,
          },
        ]}
        turns={[]}
        mcp={[]}
        uptime={[]}
        bucket="cumulative"
        since={null}
        now={10}
      />,
    );
    expect(screen.getByText("Network (MiB since start)")).toBeTruthy();
    expect(screen.getByText("Disk I/O (MiB since start)")).toBeTruthy();
    expect(screen.getByText(/cgroup RSS: gantry \+ MCP children/)).toBeTruthy();
    expect(screen.queryByText("Data dir (MiB)")).toBeNull();
    expect(screen.queryByText("Turn duration (s)")).toBeNull();
  });

  it("charts data-dir size when samples include du", () => {
    render(
      <MetricCharts
        host={[
          {
            at: 1,
            cpuPercent: 1,
            memBytes: 10,
            memLimitBytes: 20,
            diskBytes: 400 * 1024 * 1024,
          },
        ]}
        turns={[]}
        mcp={[]}
        uptime={[]}
        bucket="cumulative"
        since={null}
        now={10}
      />,
    );
    expect(screen.getByText("Data dir (MiB)")).toBeTruthy();
  });

  it("shows turn duration only when slog included it", () => {
    render(
      <MetricCharts
        host={[]}
        turns={[
          {
            at: 1,
            key: "t1",
            rounds: 1,
            recoveries: 0,
            estTokens: 10,
            promptEstTokens: 8,
            genEstTokens: 2,
            source: "user",
            userId: "1",
            sessionId: "s",
            outcome: "ok",
            durationMs: 1500,
          },
        ]}
        mcp={[]}
        uptime={[]}
        bucket="cumulative"
        since={null}
        now={10}
      />,
    );
    expect(screen.getByText("Turn duration (s)")).toBeTruthy();
    expect(screen.getByText("Turns by source")).toBeTruthy();
  });

  it("charts host CPU share from machine samples", () => {
    render(
      <HostCharts
        spark={[
          {
            at: 1,
            ncpu: 4,
            memTotalBytes: 8 * 1024 ** 3,
            craneCpu: 80,
            consoleCpu: 20,
            otherCpu: 10,
            craneMem: 1,
            consoleMem: 1,
            otherMem: 1,
            craneRx: 0,
            craneTx: 0,
            consoleRx: 0,
            consoleTx: 0,
            otherRx: 0,
            otherTx: 0,
          },
        ]}
        since={null}
        now={10}
      />,
    );
    expect(screen.getByText("CPU % of host")).toBeTruthy();
    expect(screen.getByText("RAM (GiB)")).toBeTruthy();
    expect(screen.getByText("Network rx (KiB/s)")).toBeTruthy();
    expect(screen.getAllByText(/need two samples for a rate/).length).toBeGreaterThan(0);
  });

  it("charts host rx/tx rates once two samples exist", () => {
    render(
      <HostCharts
        spark={[
          {
            at: 1_000,
            ncpu: 4,
            memTotalBytes: 8 * 1024 ** 3,
            craneCpu: 80,
            consoleCpu: 20,
            otherCpu: 10,
            craneMem: 1,
            consoleMem: 1,
            otherMem: 1,
            craneRx: 0,
            craneTx: 0,
            consoleRx: 0,
            consoleTx: 0,
            otherRx: 0,
            otherTx: 0,
          },
          {
            at: 16_000,
            ncpu: 4,
            memTotalBytes: 8 * 1024 ** 3,
            craneCpu: 80,
            consoleCpu: 20,
            otherCpu: 10,
            craneMem: 1,
            consoleMem: 1,
            otherMem: 1,
            craneRx: 150_000,
            craneTx: 40_000,
            consoleRx: 10_000,
            consoleTx: 2_000,
            otherRx: 5_000,
            otherTx: 1_000,
          },
        ]}
        since={null}
        now={20_000}
      />,
    );
    expect(screen.getByText("Network rx (KiB/s)")).toBeTruthy();
    expect(screen.getByText("Network tx (KiB/s)")).toBeTruthy();
    expect(screen.queryByText(/need two samples for a rate/)).toBeNull();
  });
});
