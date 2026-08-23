/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCharts } from "./MetricCharts";

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
});
