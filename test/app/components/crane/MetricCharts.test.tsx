/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCharts } from "@/app/components/crane/MetricCharts";

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
});
