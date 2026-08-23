/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOTFATHER_URL } from "@/lib/yard/host/telegram";
import { BotFatherHint } from "./BotFatherHint";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BotFatherHint", () => {
  it("opens BotFather and copies /newbot", async () => {
    const writeText = vi.fn(async () => undefined);
    const open = vi.fn();
    vi.stubGlobal("open", open);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<BotFatherHint slug="kit" />);
    fireEvent.click(screen.getByRole("button", { name: "Create with BotFather" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/newbot"));
    expect(open).toHaveBeenCalledWith(BOTFATHER_URL, "_blank", "noopener,noreferrer");
    expect(screen.getByRole("link", { name: "@BotFather" }).getAttribute("href")).toBe(BOTFATHER_URL);
    expect(screen.getByRole("button", { name: "kit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "@kit_bot" })).toBeTruthy();
  });
});
