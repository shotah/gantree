/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DoctorReport } from "@/lib/yard/types";
import { DoctorPanel } from "@/app/components/crane/DoctorPanel";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function report(ok: boolean, extra: DoctorReport["checks"] = []): DoctorReport {
  return {
    slug: "kit",
    ok,
    checks: [
      { id: "process", ok, detail: ok ? "container gantry-kit is running" : "container gantry-kit is exited" },
      ...extra,
    ],
  };
}

describe("DoctorPanel", () => {
  it("starts collapsed when every check is ok", () => {
    render(
      <DoctorPanel
        doctor={report(true, [{ id: "persona", ok: true, detail: "PERSONA.md present" }])}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Doctor/ });
    expect(toggle).toHaveProperty("ariaExpanded", "false");
    expect(screen.getByText("ok · 2 checks")).toBeTruthy();
    expect(screen.getByText("all checks ok — expand for detail")).toBeTruthy();
    expect(screen.queryByText("PERSONA.md present")).toBeNull();
  });

  it("starts collapsed when a check fails", () => {
    render(
      <DoctorPanel
        doctor={report(false, [{ id: "persona", ok: false, detail: "PERSONA.md missing" }])}
      />,
    );

    expect(screen.getByRole("button", { name: /Doctor/ })).toHaveProperty("ariaExpanded", "false");
    expect(screen.getByText("2 fail · 2 checks")).toBeTruthy();
    expect(screen.getByText("2 failing — expand for detail")).toBeTruthy();
    expect(screen.queryByText("PERSONA.md missing")).toBeNull();
  });

  it("expands the check list on header click", () => {
    render(
      <DoctorPanel
        doctor={report(false, [{ id: "persona", ok: false, detail: "PERSONA.md missing" }])}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Doctor/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveProperty("ariaExpanded", "true");
    expect(screen.getByText("PERSONA.md missing")).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText("PERSONA.md missing")).toBeNull();
  });
});
