/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventStrip } from "@/app/components/shared/EventStrip";
import { craneFoldKey, craneLayoutKey } from "@/app/components/shared/DashFold";

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
  localStorage.clear();
  vi.mocked(useDoor).mockReturnValue({ ready: false, operator: null });
});

function calls(): string[] {
  return vi.mocked(yardFetch).mock.calls.map((c) => String(c[0]));
}

describe("EventStrip", () => {
  it("keeps kind and time filters when the list is empty", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByLabelText("Event kind")).toBeTruthy());
    expect(screen.getByText("No events in last 7d")).toBeTruthy();
    expect(screen.getByText("Yard events")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Time window" })).toBeTruthy();
    expect(screen.getByRole("log", { name: "Yard events" })).toBeTruthy();
    expect(screen.getByRole("log").className).toMatch(/overflow-auto/);
    expect(screen.queryByRole("option", { name: "login" })).toBeNull();
    expect(screen.queryByRole("option", { name: "logout" })).toBeNull();
    expect(calls().some((u) => u.includes("window=7d") && u.includes("limit=100"))).toBe(true);
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
    await waitFor(() => expect(calls().some((u) => u.includes("kind=login"))).toBe(true));
  });

  it("narrows the audit window without losing the kind filter", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByRole("button", { name: "24h" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "24h" }));
    await waitFor(() => expect(calls().some((u) => u.includes("window=24h") && u.includes("limit=100"))).toBe(true));
    expect(screen.getByText("No events in last 24h")).toBeTruthy();
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
    await waitFor(() => expect(screen.getByRole("button", { name: /Events on this crane/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Events on this crane/ }));
    await waitFor(() => expect(screen.getByLabelText("Event kind")).toBeTruthy());
    expect(screen.queryByRole("option", { name: "login" })).toBeNull();
    expect(screen.queryByRole("option", { name: "logout" })).toBeNull();
  });

  it("shares the crane events fold across slugs", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ events: [] }),
    } as Response);
    render(<EventStrip slug="kit" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Events on this crane/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Events on this crane/ }));
    expect(localStorage.getItem(craneLayoutKey("events"))).toBe("1");
    expect(localStorage.getItem(craneFoldKey("kit", "events"))).toBeNull();
  });

  it("passes kind into the events query", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({
        events: [{ id: 1, at: "2026-08-22T18:00:00Z", kind: "recreate", slug: "kit", operatorId: "1", operatorName: "kit", detail: "ok" }],
      }),
    } as Response);
    render(<EventStrip />);
    await waitFor(() => expect(screen.getByRole("log").querySelector("li")).toBeTruthy());
    expect(screen.getByRole("link", { name: "kit" })).toHaveProperty("href", expect.stringMatching(/\/gantries\/kit$/));
    const row = screen.getByRole("log").querySelector("li");
    expect(row?.textContent).toMatch(/recreate/);
    expect(row?.className).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
    expect(row?.querySelector("time")?.textContent).toMatch(/ago/);
    fireEvent.change(screen.getByLabelText("Event kind"), { target: { value: "recreate" } });
    await waitFor(() => expect(calls().some((u) => u.includes("kind=recreate"))).toBe(true));
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
      expect(calls().some((u) => u.includes("format=jsonl") && u.includes("window=7d") && u.includes("limit=200"))).toBe(true),
    );
    expect(create).toHaveBeenCalled();
  });
});
