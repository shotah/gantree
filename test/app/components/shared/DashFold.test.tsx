/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { craneFoldKey, DashFold } from "@/app/components/shared/DashFold";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("DashFold", () => {
  it("starts collapsed", () => {
    render(
      <DashFold title="Photo" summary="avatar" hint="persona/avatar.jpg">
        <p>photo body</p>
      </DashFold>,
    );

    const toggle = screen.getByRole("button", { name: /Photo/ });
    expect(toggle).toHaveProperty("ariaExpanded", "false");
    expect(screen.getByText("avatar")).toBeTruthy();
    expect(screen.getByText("persona/avatar.jpg")).toBeTruthy();
    expect(screen.queryByText("photo body")).toBeNull();
    expect(toggle.closest("section")?.className).toContain("border-zinc-800");
    expect(toggle.closest("section")?.className).toContain("rounded-lg");
    expect(toggle.querySelector("[aria-hidden]")?.className).toContain("rounded-full");
  });

  it("marks a dangerous fold with a warn chip", () => {
    render(
      <DashFold title="Inventory" warn hint="writes the whole yard">
        <p>toml</p>
      </DashFold>,
    );
    expect(screen.getByText("warn")).toBeTruthy();
    expect(screen.getByText("writes the whole yard")).toBeTruthy();
  });

  it("starts open when defaultOpen is set", () => {
    render(
      <DashFold title="Logs" defaultOpen persistKey={craneFoldKey("kit", "logs")}>
        <p>slog body</p>
      </DashFold>,
    );

    expect(screen.getByRole("button", { name: /Logs/ })).toHaveProperty("ariaExpanded", "true");
    expect(screen.getByText("slog body")).toBeTruthy();
  });

  it("toggles the body on header click", () => {
    render(
      <DashFold title="Logs">
        <p>slog body</p>
      </DashFold>,
    );
    const toggle = screen.getByRole("button", { name: /Logs/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveProperty("ariaExpanded", "true");
    expect(screen.getByText("slog body")).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle).toHaveProperty("ariaExpanded", "false");
    expect(screen.queryByText("slog body")).toBeNull();
  });

  it("lets aside clicks fire without expanding", () => {
    const onAside = vi.fn();
    render(
      <DashFold title="Metrics" aside={<button type="button" onClick={onAside}>6h</button>}>
        <p>charts</p>
      </DashFold>,
    );

    fireEvent.click(screen.getByRole("button", { name: "6h" }));
    expect(onAside).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("charts")).toBeNull();
  });

  it("remembers the last open state for a persistKey", async () => {
    const key = craneFoldKey("kit", "logs");
    localStorage.setItem(key, "0");
    render(
      <DashFold title="Logs" defaultOpen persistKey={key}>
        <p>slog body</p>
      </DashFold>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /Logs/ })).toHaveProperty("ariaExpanded", "false"));
    expect(screen.queryByText("slog body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Logs/ }));
    expect(screen.getByText("slog body")).toBeTruthy();
    expect(localStorage.getItem(key)).toBe("1");
  });
});
