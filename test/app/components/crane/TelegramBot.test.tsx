/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelegramBot } from "@/app/components/crane/TelegramBot";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("TelegramBot", () => {
  it("renders nothing when the crane is not telegram", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({ enabled: false, detail: "not telegram" }),
    } as Response);
    const { container } = render(
      <TelegramBot slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />,
    );
    await waitFor(() => expect(vi.mocked(yardFetch)).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("shows @username and seen ids when telegram is live", async () => {
    vi.mocked(yardFetch).mockResolvedValue({
      json: async () => ({
        enabled: true,
        tokenSet: true,
        bot: { id: 99, username: "kit_bot", firstName: "Kit" },
        name: "Kit",
        description: "blurb",
        shortDescription: "about",
        commands: [{ command: "tools", description: "list granted MCP" }],
        allowlist: ["1"],
        seen: [{ id: "9", turns: 2, lastAt: 10 }],
        link: "https://t.me/kit_bot",
        detail: "@kit_bot",
      }),
    } as Response);
    render(<TelegramBot slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />);
    await waitFor(() => expect(screen.getByText("@kit_bot")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Telegram/ }));
    const phone = await waitFor(() => screen.getByRole("link", { name: /open on phone/ }));
    expect(phone.getAttribute("href")).toBe("https://t.me/kit_bot");
    expect(screen.getByText(/add 9/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ask 1 to tap \/new/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Put \/new in \/ menu/ })).toBeTruthy();
    expect((screen.getByPlaceholderText("numeric id") as HTMLInputElement).value).toBe("");
  });

  it("offers Profile telegram ids that are not on the allowlist", async () => {
    vi.mocked(yardFetch).mockImplementation(async (url) => {
      if (String(url).includes("/api/operators")) {
        return {
          json: async () => ({
            operators: [{ name: "ada", displayName: "Ada", channels: { telegram: ["99"], slack: [], discord: [] } }],
          }),
        } as Response;
      }
      return {
        json: async () => ({
          enabled: true,
          tokenSet: true,
          bot: { id: 99, username: "kit_bot", firstName: "Kit" },
          name: "Kit",
          description: "blurb",
          shortDescription: "about",
          commands: [{ command: "tools", description: "list granted MCP" }],
          allowlist: [],
          seen: [{ id: "9", turns: 2, lastAt: 10 }],
          link: "https://t.me/kit_bot",
          detail: "@kit_bot",
        }),
      } as Response;
    });
    render(<TelegramBot slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />);
    await waitFor(() => expect(screen.getByText("@kit_bot")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Telegram/ }));
    await waitFor(() => expect(screen.getByText(/add Ada/)).toBeTruthy());
    expect(screen.getByText("99")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add Ada/ }));
    expect(screen.getByText("99 ×")).toBeTruthy();
    expect(screen.getByRole("button", { name: /ask Ada to tap \/new/ })).toBeTruthy();
  });

  it("posts /new for an allowlisted chatter", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.mocked(yardFetch).mockImplementation(async (url, init) => {
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url: String(url), body });
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          enabled: true,
          tokenSet: true,
          bot: { id: 99, username: "kit_bot", firstName: "Kit" },
          name: "Kit",
          description: "",
          shortDescription: "",
          commands: [],
          allowlist: ["9"],
          seen: [{ id: "9", turns: 12, lastAt: 10 }],
          link: "https://t.me/kit_bot",
          detail: "asked 9 to tap /new",
        }),
      } as Response;
    });
    render(<TelegramBot slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />);
    await waitFor(() => expect(screen.getByText("@kit_bot")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Telegram/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /ask 9 to tap \/new/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /ask 9 to tap \/new/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/telegram") && c.body?.includes('"op":"new"') && c.body?.includes('"id":"9"'))).toBe(true),
    );
  });

  it("calls out a missing bot token instead of looking set", async () => {
    vi.mocked(yardFetch).mockImplementation(async (url) => {
      if (String(url).includes("/api/operators")) {
        return { json: async () => ({ operators: [] }) } as Response;
      }
      return {
        json: async () => ({
          enabled: true,
          tokenSet: false,
          bot: null,
          name: "",
          description: "",
          shortDescription: "",
          commands: [],
          allowlist: [],
          seen: [],
          detail: "no TELEGRAM_BOT_TOKEN",
        }),
      } as Response;
    });
    render(<TelegramBot slug="kit" busy={false} setBusy={() => undefined} onNotice={() => undefined} onSaved={() => undefined} />);
    await waitFor(() => expect(screen.getByText("no token")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Telegram/ }));
    await waitFor(() => expect(screen.getByText(/Paste TELEGRAM_BOT_TOKEN in Secrets/)).toBeTruthy());
  });

  it("signals env written after saving the allowlist", async () => {
    const onEnvWritten = vi.fn();
    vi.mocked(yardFetch).mockImplementation(async (url, init) => {
      if (String(url).includes("/api/operators")) {
        return { json: async () => ({ operators: [] }) } as Response;
      }
      const posted = typeof init?.body === "string" && init.body.includes('"op":"allowlist"');
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          enabled: true,
          tokenSet: true,
          bot: { id: 99, username: "kit_bot", firstName: "Kit" },
          name: "Kit",
          description: "",
          shortDescription: "",
          commands: [],
          allowlist: ["1"],
          seen: [],
          link: "https://t.me/kit_bot",
          detail: posted ? "allowlist 1 id(s) — recreate to apply (do not just restart)" : "@kit_bot",
        }),
      } as Response;
    });
    render(
      <TelegramBot
        slug="kit"
        busy={false}
        setBusy={() => undefined}
        onNotice={() => undefined}
        onSaved={() => undefined}
        onEnvWritten={onEnvWritten}
      />,
    );
    await waitFor(() => expect(screen.getByText("@kit_bot")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Telegram/ }));
    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: "Save allowlist" })));
    await waitFor(() => expect(onEnvWritten).toHaveBeenCalledTimes(1));
  });
});
