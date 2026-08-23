/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatorProfile } from "./OperatorProfile";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "../lib/yardFetch";

afterEach(() => {
  cleanup();
});

describe("OperatorProfile", () => {
  it("shows you and passphrase, not the operator list", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({
        operators: [{ id: "1", name: "kit", displayName: "Kit", role: "admin", cranes: [], createdAt: "now" }],
        you: {
          id: "1",
          name: "kit",
          displayName: "Kit",
          email: "",
          description: "",
          role: "admin",
          cranes: [],
          channels: { telegram: [], slack: [], discord: [] },
          avatarRev: null,
          createdAt: "now",
        },
      }),
    } as Response);
    render(<OperatorProfile />);
    await waitFor(() => expect(screen.getByText("Profile")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update passphrase" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add operator" })).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();
    const you = screen.getByRole("button", { name: "Save profile" }).closest("form");
    const pass = screen.getByRole("button", { name: "Update passphrase" }).closest("form");
    expect(you?.parentElement).toBe(pass?.parentElement);
    expect(you?.parentElement?.className).toMatch(/flex-wrap/);
    expect(you?.parentElement?.className).toMatch(/items-start/);
  });
});
