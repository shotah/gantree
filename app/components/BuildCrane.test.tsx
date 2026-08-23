/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildCrane } from "./BuildCrane";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("BuildCrane", () => {
  it("disables life-cast when the yard is a cloud VM", () => {
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));

    const lifeCast = screen.getByRole("option", { name: "life-cast (home only)" }) as HTMLOptionElement;
    expect(lifeCast.disabled).toBe(false);

    fireEvent.change(screen.getByDisplayValue("home Mini"), { target: { value: "cloud" } });
    expect(lifeCast.disabled).toBe(true);
  });
});
