/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatorProfile } from "@/app/components/operators/OperatorProfile";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

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
    expect(you?.parentElement?.className).toMatch(/min-w-0/);
    expect(you?.className).toMatch(/min-w-0/);
    expect(you?.className).toMatch(/basis-full/);
    expect(you?.className).toMatch(/sm:basis-\[28rem\]/);
  });

  it("lets an admin edit another operator without the passphrase form", async () => {
    let posted: Record<string, unknown> | null = null;
    vi.mocked(yardFetch).mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        posted = JSON.parse(String(init.body)) as Record<string, unknown>;
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      return {
        json: async () => ({
          operators: [
            {
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
            {
              id: "2",
              name: "ada",
              displayName: "Ada",
              email: "ada@example.com",
              description: "builds",
              role: "user",
              cranes: ["kit"],
              channels: { telegram: ["42"], slack: [], discord: [] },
              avatarRev: null,
              createdAt: "now",
            },
          ],
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
      } as Response;
    });
    render(<OperatorProfile operatorId="2" />);
    await waitFor(() => expect(screen.getByDisplayValue("ada@example.com")).toBeTruthy());
    expect(screen.getByDisplayValue("builds")).toBeTruthy();
    expect(screen.getByRole("button", { name: /42/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update passphrase" })).toBeTruthy();
    expect(screen.queryByLabelText("current")).toBeNull();
    expect(screen.getByRole("link", { name: /settings/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(posted).toMatchObject({ op: "profile", id: "2", email: "ada@example.com" }));
  });

  it("lets an admin set another operator's passphrase", async () => {
    let posted: Record<string, unknown> | null = null;
    vi.mocked(yardFetch).mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        posted = JSON.parse(String(init.body)) as Record<string, unknown>;
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      return {
        json: async () => ({
          operators: [
            {
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
            {
              id: "2",
              name: "ada",
              displayName: "Ada",
              email: "ada@example.com",
              description: "builds",
              role: "user",
              cranes: ["kit"],
              channels: { telegram: ["42"], slack: [], discord: [] },
              avatarRev: null,
              createdAt: "now",
            },
          ],
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
      } as Response;
    });
    render(<OperatorProfile operatorId="2" />);
    await waitFor(() => expect(screen.getByText("Set Ada's passphrase")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("new", { exact: true }), { target: { value: "brand-new-pass" } });
    fireEvent.change(screen.getByLabelText("confirm new"), { target: { value: "brand-new-pass" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Update passphrase" }));
    await waitFor(() =>
      expect(posted).toMatchObject({ op: "passphrase", id: "2", next: "brand-new-pass", confirm: true }));
    expect(posted).not.toHaveProperty("current");
  });
});
