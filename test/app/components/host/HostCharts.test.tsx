/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostCharts } from "@/app/components/host/HostCharts";

afterEach(() => {
  cleanup();
});

describe("HostCharts", () => {
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
