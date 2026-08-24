/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSelect } from "@/app/components/shared/ThemeSelect";
import { applyTheme, THEME_KEY, THEMES } from "@/app/lib/theme";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

function openThemes() {
  fireEvent.click(screen.getByLabelText("color theme"));
}

function swatchHalves(el: HTMLElement) {
  const swatch = el.querySelector("[data-theme-swatch]");
  expect(swatch).toBeTruthy();
  return Array.from(swatch!.children) as HTMLElement[];
}

function rgb(hex: string) {
  const n = hex.slice(1);
  return `rgb(${Number.parseInt(n.slice(0, 2), 16)}, ${Number.parseInt(n.slice(2, 4), 16)}, ${Number.parseInt(n.slice(4, 6), 16)})`;
}

describe("ThemeSelect", () => {
  it("lists every theme", () => {
    render(<ThemeSelect />);
    openThemes();
    expect(screen.getByRole("option", { name: "Dark" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Dark · dock" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Light · mist" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "High contrast" })).toBeTruthy();
  });

  it("writes the chosen theme onto html so tokens swap", () => {
    render(<ThemeSelect />);
    openThemes();
    fireEvent.click(screen.getByRole("option", { name: "Light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
    expect(localStorage.getItem(THEME_KEY)).toBe("paper");
    expect(screen.getByLabelText("color theme").textContent).toContain("Light");
  });

  it("paints a two-tone swatch from canvas and accent on each option", () => {
    render(<ThemeSelect />);
    openThemes();
    for (const t of THEMES) {
      const [left, right] = swatchHalves(screen.getByRole("option", { name: t.label }));
      expect(left.style.backgroundColor).toBe(rgb(t.tokens.canvas));
      expect(right.style.backgroundColor).toBe(rgb(t.tokens.accent));
    }
  });

  it("skips a no-op apply so storage listeners cannot loop", () => {
    applyTheme("mist");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    applyTheme("mist");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
