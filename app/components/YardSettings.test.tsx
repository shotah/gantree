/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YardSettings } from "./YardSettings";

vi.mock("../lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "../lib/yardFetch";

afterEach(() => {
  cleanup();
});

describe("YardSettings", () => {
  it("shows the three roles and an add form for an admin", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/gantries")) {
        return { json: async () => ({ gantries: [{ slug: "kit" }] }) } as Response;
      }
      return {
        json: async () => ({
          operators: [{ id: "1", name: "kit", displayName: "kit", role: "admin", cranes: [], createdAt: "now" }],
          you: { id: "1", name: "kit", displayName: "kit", role: "admin", cranes: [], createdAt: "now" },
        }),
      } as Response;
    });
    render(<YardSettings />);
    await waitFor(() => expect(screen.getByText("Settings")).toBeTruthy());
    expect(screen.getByText(/full access/)).toBeTruthy();
    expect(screen.getByText(/card and details/)).toBeTruthy();
    expect(screen.getByText(/assigned cranes — look/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add operator" })).toBeTruthy();
    expect(screen.getAllByLabelText("role").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "kit" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Update passphrase" })).toBeNull();
  });

  it("hides add/remove for readonly", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({
        operators: [{ id: "2", name: "look", displayName: "look", role: "readonly", cranes: [], createdAt: "now" }],
        you: { id: "2", name: "look", displayName: "look", role: "readonly", cranes: [], createdAt: "now" },
      }),
    } as Response);
    render(<YardSettings />);
    await waitFor(() => expect(screen.getByText("Settings")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Add operator" })).toBeNull();
    expect(screen.queryByRole("button", { name: "remove" })).toBeNull();
  });
});
