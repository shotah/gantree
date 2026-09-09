/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PendantPanel } from "@/app/components/crane/PendantPanel";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

vi.mock("@/app/components/shared/DoorShell", () => ({
  useDoor: vi.fn(() => ({
    ready: true,
    operator: { id: "1", name: "kit", displayName: "Kit", role: "admin" as const, cranes: [], avatarRev: null },
  })),
}));

import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("PendantPanel", () => {
  it("renders nothing when the crane is not pendant", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ enabled: false, detail: "not pendant" }),
    } as Response);
    const { container } = render(
      <PendantPanel slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />,
    );
    await waitFor(() => expect(vi.mocked(yardFetch)).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("ticks an operator email onto the allowlist and signals env written", async () => {
    const onEnvWritten = vi.fn();
    vi.mocked(yardFetch).mockImplementation(async (url, init) => {
      if (String(url).includes("/api/operators")) {
        return {
          json: async () => ({
            operators: [
              {
                id: "2",
                name: "ada",
                displayName: "Ada",
                email: "ada@example.com",
                channels: { telegram: [], slack: [], discord: [], google: [] },
              },
            ],
          }),
        } as Response;
      }
      const posted = typeof init?.body === "string" && String(init.method) === "PUT";
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          enabled: true,
          mailboxUrl: "wss://example/ws/kit",
          bearerSet: true,
          allowlist: posted ? ["ada@example.com"] : [],
          seen: [{ id: "118212345678901234567", turns: 2, lastAt: 10 }],
          suggestion: null,
          detail: posted ? "allowlist 1 entry — recreate to apply (do not just restart)" : "pendant",
        }),
      } as Response;
    });
    render(
      <PendantPanel
        slug="kit"
        busy={false}
        setBusy={() => undefined}
        onNotice={() => undefined}
        onSaved={() => undefined}
        onEnvWritten={onEnvWritten}
      />,
    );
    await waitFor(() => expect(screen.getByText("0 on the list")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Pendant/ }));
    await waitFor(() => expect(screen.getByText("ada@example.com")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Rotate bearer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Ada/ }));
    expect(screen.getByText("ada@example.com ×")).toBeTruthy();
    expect(screen.getByText(/add 118212345678901234567/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save allowlist" }));
    await waitFor(() => expect(onEnvWritten).toHaveBeenCalledTimes(1));
  });

  it("offers to store an unseen sub on the matching operator", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.mocked(yardFetch).mockImplementation(async (url, init) => {
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url: String(url), body });
      if (String(url).includes("/api/operators") && init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (String(url).includes("/api/operators")) {
        return { json: async () => ({ operators: [] }) } as Response;
      }
      return {
        json: async () => ({
          enabled: true,
          mailboxUrl: "wss://example/ws/kit",
          bearerSet: true,
          allowlist: ["ada@example.com"],
          seen: [{ id: "118212345678901234567", turns: 1, lastAt: 10 }],
          suggestion: {
            userId: "118212345678901234567",
            operatorId: "2",
            operatorName: "Ada",
            email: "ada@example.com",
          },
          detail: "pendant",
        }),
      } as Response;
    });
    render(
      <PendantPanel slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />,
    );
    await waitFor(() => expect(screen.getByText("1 on the list")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Pendant/ }));
    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: /store on Ada's profile/ })));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/api/operators") && c.body?.includes('"op":"google-sub"') && c.body?.includes("118212345678901234567"))).toBe(true),
    );
  });

  it("posts rotate with confirm", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    vi.mocked(yardFetch).mockImplementation(async (url, init) => {
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url: String(url), method: init?.method, body });
      if (String(url).includes("/api/operators")) {
        return { json: async () => ({ operators: [] }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          enabled: true,
          mailboxUrl: "wss://example/ws/kit",
          bearerSet: true,
          allowlist: [],
          seen: [],
          suggestion: null,
          detail: "rotated bearer — recreate to apply (do not just restart)",
        }),
      } as Response;
    });
    const onEnvWritten = vi.fn();
    render(
      <PendantPanel
        slug="kit"
        busy={false}
        setBusy={() => undefined}
        onNotice={() => undefined}
        onSaved={() => undefined}
        onEnvWritten={onEnvWritten}
      />,
    );
    await waitFor(() => expect(screen.getByText("0 on the list")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Pendant/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /rotating this crane/ }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate bearer" }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/pendant") && c.method === "POST" && c.body?.includes('"op":"rotate"') && c.body?.includes('"confirm":true'))).toBe(true),
    );
    await waitFor(() => expect(onEnvWritten).toHaveBeenCalled());
  });
});
