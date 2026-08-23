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
        operators: [{ id: "1", name: "kit", displayName: "Kit", role: "admin", crane: null, createdAt: "now" }],
        you: {
          id: "1",
          name: "kit",
          displayName: "Kit",
          email: "",
          description: "",
          role: "admin",
          crane: null,
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
  });
});
