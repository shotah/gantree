/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildCrane } from "@/app/components/yard/BuildCrane";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  cleanup();
});

describe("BuildCrane", () => {
  beforeEach(() => {
    vi.mocked(yardFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/pendant")) {
        return { ok: true, json: async () => ({ pendant: { ready: false } }) } as Response;
      }
      return { ok: true, json: async () => ({ operators: [] }) } as Response;
    });
  });
  it("disables life-cast when the yard is a cloud VM", () => {
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));

    const lifeCast = screen.getByRole("option", { name: "life-cast (home only)" }) as HTMLOptionElement;
    expect(lifeCast.disabled).toBe(false);

    fireEvent.change(screen.getByDisplayValue("home Mini"), { target: { value: "cloud" } });
    expect(lifeCast.disabled).toBe(true);
  });

  it("describes bot token on the label so a hover can show what to paste", () => {
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));
    const input = screen.getByLabelText("bot token");
    const tip = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(tip?.textContent).toMatch(/BotFather/);
    expect(tip?.textContent).toMatch(/123456789:/);
  });

  it("nags Settings when pendant is picked and Cloudflare is not ready", async () => {
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));
    fireEvent.change(screen.getByDisplayValue("telegram"), { target: { value: "pendant" } });
    await waitFor(() => expect(screen.getByText(/Settings → Pendant first/)).toBeTruthy());
    expect(screen.queryByLabelText("mailbox URL")).toBeNull();
    expect(screen.queryByLabelText("mailbox bearer")).toBeNull();
    expect((screen.getByRole("button", { name: "Build crane" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides bearer paste when Cloudflare is ready and still ticks an allowlist", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/pendant")) {
        return {
          ok: true,
          json: async () => ({
            pendant: { ready: true, origin: "https://gantry-pendant.example.workers.dev" },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          operators: [
            {
              id: "2",
              name: "ada",
              displayName: "Ada",
              email: "ada@example.com",
              channels: { telegram: ["99"], google: [] },
            },
          ],
        }),
      } as Response;
    });
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));
    fireEvent.change(screen.getByDisplayValue("telegram"), { target: { value: "pendant" } });
    await waitFor(() => expect(screen.getByText(/minted here and pushed/)).toBeTruthy());
    expect(screen.queryByLabelText("mailbox bearer")).toBeNull();
    await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
    fireEvent.click(screen.getByRole("checkbox", { name: /Ada/ }));
    expect((screen.getByLabelText("pendant allowlist") as HTMLInputElement).value).toBe("ada@example.com");
  });

  it("does not look pre-filled when the bot token is still blank", () => {
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));
    const input = screen.getByLabelText("bot token") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("needs a token");
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "123:secret" } });
    expect((screen.getByLabelText("bot token") as HTMLInputElement).type).toBe("password");
  });

  it("ticks a profile email into the pendant allowlist", async () => {
    vi.mocked(yardFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/pendant")) {
        return {
          ok: true,
          json: async () => ({ pendant: { ready: true, origin: "https://p.example.workers.dev" } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          operators: [
            {
              id: "2",
              name: "ada",
              displayName: "Ada",
              email: "ada@example.com",
              channels: { telegram: ["99"], google: [] },
            },
          ],
        }),
      } as Response;
    });
    render(<BuildCrane onBuilt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Build a crane" }));
    fireEvent.change(screen.getByDisplayValue("telegram"), { target: { value: "pendant" } });
    await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
    fireEvent.click(screen.getByRole("checkbox", { name: /Ada/ }));
    expect((screen.getByLabelText("pendant allowlist") as HTMLInputElement).value).toBe("ada@example.com");
  });
});
