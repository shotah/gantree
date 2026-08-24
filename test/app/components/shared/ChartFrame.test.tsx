/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartFrame, wash } from "@/app/components/shared/ChartFrame";

afterEach(() => {
  cleanup();
});

describe("ChartFrame", () => {
  it("lets the plot shrink inside a phone column instead of a 600px Recharts default", () => {
    render(
      <ChartFrame title="CPU %" empty={false}>
        <div>plot</div>
      </ChartFrame>,
    );

    const title = screen.getByRole("heading", { name: "CPU %" });
    expect(title.parentElement?.className).toMatch(/min-w-0/);
    const plot = title.nextElementSibling;
    expect(plot?.className).toMatch(/w-full/);
    expect(plot?.className).toMatch(/min-w-0/);
    expect(plot?.querySelector("[data-chart]")?.className).toMatch(/w-full/);
    expect(plot?.querySelector("[data-chart]")?.className).toMatch(/min-w-0/);
  });

  it("washes a series color for chart fills", () => {
    expect(wash("var(--accent)")).toBe("color-mix(in srgb, var(--accent) 20%, transparent)");
    expect(wash("var(--ok)", 13)).toBe("color-mix(in srgb, var(--ok) 13%, transparent)");
  });
});
