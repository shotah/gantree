/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventStrip } from "@/app/components/shared/EventStrip";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

vi.mock("@/app/components/shared/DoorShell", () => ({
  useDoor: vi.fn(() => ({ ready: false, operator: null })),
}));

import { yardFetch } from "@/app/lib/yardFetch";
import { useDoor } from "@/app/components/shared/DoorShell";

afterEach(() => {
  cleanup();
  vi.mocked(useDoor).mockReturnValue({ ready: false, operator: null });
});

describe("EventStrip", () => {
  it("keeps the kind filter when the list is empty", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByLabelText("Event kind")).toBeTruthy());
    expect(screen.getByText("no events yet")).toBeTruthy();
    expect(screen.getByText("Yard events")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "login" })).toBeNull();
    expect(screen.queryByRole("option", { name: "logout" })).toBeNull();
  });

  it("lets an admin filter yard events to login and logout", async () => {
    vi.mocked(useDoor).mockReturnValue({
      ready: true,
      operator: { id: "1", name: "kit", displayName: "Kit", role: "admin", cranes: [], avatarRev: null },
    });
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByRole("option", { name: "login" })).toBeTruthy());
    expect(screen.getByRole("option", { name: "logout" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Event kind"), { target: { value: "login" } });
    await waitFor(() =>
      expect(vi.mocked(yardFetch).mock.calls.some((c) => String(c[0]).includes("kind=login"))).toBe(true),
    );
  });

  it("hides login and logout on a crane strip even for admin", async () => {
    vi.mocked(useDoor).mockReturnValue({
      ready: true,
      operator: { id: "1", name: "kit", displayName: "Kit", role: "admin", cranes: [], avatarRev: null },
    });
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip slug="kit" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Recent on this crane/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Recent on this crane/ }));
    await waitFor(() => expect(screen.getByLabelText("Event kind")).toBeTruthy());
    expect(screen.queryByRole("option", { name: "login" })).toBeNull();
    expect(screen.queryByRole("option", { name: "logout" })).toBeNull();
  });

  it("passes kind into the events query", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({
        events: [{ id: 1, at: "2026-08-22T18:00:00Z", kind: "recreate", slug: "kit", operatorId: "1", operatorName: "kit", detail: "ok" }],
      }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByText("recreate")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Event kind"), { target: { value: "recreate" } });
    await waitFor(() =>
      expect(vi.mocked(yardFetch).mock.calls.some((c) => String(c[0]).includes("kind=recreate"))).toBe(true),
    );
  });

  it("downloads the filtered list as jsonl", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
      blob: async () => new Blob(["{}\n"]),
    } as Response);
    const create = vi.fn(() => "blob:events");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revoke });
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByRole("button", { name: "jsonl" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "jsonl" }));
    await waitFor(() =>
      expect(vi.mocked(yardFetch).mock.calls.some((c) => String(c[0]).includes("format=jsonl"))).toBe(true),
    );
    expect(create).toHaveBeenCalled();
  });
});
