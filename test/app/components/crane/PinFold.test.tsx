/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PinFold } from "@/app/components/crane/PinFold";
import type { AgentDash } from "@/app/components/crane/useAgentDashboard";
import { DEFAULT_IMAGE } from "@/lib/yard/types";
import { card } from "@/test/yard/card";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function dash(over: { gantry?: ReturnType<typeof card>; imageBehind?: boolean } = {}): AgentDash {
  return {
    pin: DEFAULT_IMAGE,
    setPin: vi.fn(),
    mutate: true,
    busy: false,
    act: vi.fn(),
    gantry: card({
      version: "1.2.0",
      commit: "cafebabe",
      imageBehind: over.imageBehind ?? false,
      ...over.gantry,
    }),
  } as unknown as AgentDash;
}

describe("PinFold", () => {
  it("keeps the pin on :latest and shows this container's gantry version", () => {
    render(<PinFold dash={dash()} />);
    expect(screen.getByText("1.2.0 · cafebabe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Image pin/ }));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(DEFAULT_IMAGE);
    expect(screen.getByText(/this container: 1\.2\.0 · cafebabe/)).toBeTruthy();
    expect(screen.queryByText(/older/)).toBeNull();
  });

  it("warns when this container is older than a peer", () => {
    render(<PinFold dash={dash({ imageBehind: true })} />);
    expect(screen.getByText("warn")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Image pin/ }));
    expect(screen.getByText(/older — pull \+ recreate/)).toBeTruthy();
  });
});
