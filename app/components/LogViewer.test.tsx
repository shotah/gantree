/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogViewer } from "./LogViewer";
import type { LogLine } from "@/lib/yard/types";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "../lib/yardFetch";

class FakeEventSource {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  static instances: FakeEventSource[] = [];
}

const lines: LogLine[] = [
  { ts: "2026-08-22T18:00:00Z", level: "ERROR", msg: "kit boom", raw: "kit boom", json: null, kind: "error", turnId: "t1" },
  { ts: "2026-08-22T18:00:01Z", level: "INFO", msg: "turn perf", raw: "turn perf", json: null, kind: "turn", turnId: "t1" },
  { ts: "2026-08-22T18:00:02Z", level: "INFO", msg: "jules hello", raw: "jules hello", json: null, kind: "info", turnId: null },
];

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(yardFetch).mockResolvedValue({
    json: async () => ({ lines }),
  } as Response);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LogViewer", () => {
  it("filters by search and kind without mixing untagged lines into a turn", async () => {
    render(<LogViewer slug="kit" />);
    await waitFor(() => expect(screen.getByText("kit boom")).toBeTruthy());
    expect(vi.mocked(yardFetch).mock.calls[0]?.[0]).toBe("/api/gantries/kit/logs?tail=200");
    expect(FakeEventSource.instances[0]?.url).toBe("/api/gantries/kit/logs?tail=0&follow=1");
    expect(screen.getByText(/turn t1/)).toBeTruthy();
    expect(screen.getByText("jules hello")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("search logs"), { target: { value: "boom" } });
    expect(screen.getByText("kit boom")).toBeTruthy();
    expect(screen.queryByText("jules hello")).toBeNull();
    expect(screen.queryByText("turn perf")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("search logs"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("all"), { target: { value: "error" } });
    expect(screen.getByText("kit boom")).toBeTruthy();
    expect(screen.queryByText("jules hello")).toBeNull();
    expect(screen.queryByText("turn perf")).toBeNull();
  });
});
