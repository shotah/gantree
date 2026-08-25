/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InjectUserModal } from "@/app/components/crane/InjectUserModal";
import { personaMarkdown } from "@/lib/yard/crane/seed";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

import { yardFetch } from "@/app/lib/yardFetch";

afterEach(() => {
  cleanup();
});

function json(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: async () => data,
  } as Response);
}

describe("InjectUserModal", () => {
  it("injects checked operator fields into About you and leaves Identity alone", async () => {
    vi.mocked(yardFetch).mockImplementation((url) => {
      expect(String(url)).toContain("/api/operators");
      return json({
        you: { id: "1", name: "kit", displayName: "Kit" },
        operators: [
          {
            id: "2",
            name: "ada",
            displayName: "Ada",
            email: "ada@example.com",
            description: "likes rye",
            timezone: "America/New_York",
            location: "Brooklyn, New York",
            channels: { telegram: ["99"], slack: [], discord: [] },
          },
        ],
      });
    });
    const onInject = vi.fn();
    render(<InjectUserModal persona={personaMarkdown("kit")} onClose={() => undefined} onInject={onInject} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    await waitFor(() => expect(screen.getByText("ada@example.com")).toBeTruthy());

    fireEvent.click(screen.getByRole("checkbox", { name: /description/ }));
    fireEvent.click(screen.getByRole("button", { name: "Inject" }));

    expect(onInject).toHaveBeenCalledTimes(1);
    const [next, label] = onInject.mock.calls[0] as [string, string];
    expect(label).toBe("Ada");
    expect(next).toContain("- **Name:** Kit");
    expect(next).toContain("- **Name:** Ada");
    expect(next).toContain("- **Google / Workspace email (canonical):** ada@example.com");
    expect(next).toContain("- **Timezone:** America/New_York");
    expect(next).not.toContain("- **Timezone:** America/Los_Angeles");
    expect(next).toContain("- **Location:** Brooklyn, New York");
    expect(next).toContain("- **Telegram id:** 99");
    expect(next).not.toContain("- **Notes:** likes rye");
  });

  it("disables empty fields so they cannot be injected", async () => {
    vi.mocked(yardFetch).mockResolvedValue(
      (await json({
        operators: [
          {
            id: "1",
            name: "kit",
            displayName: "Kit",
            email: "",
            description: "",
            channels: { telegram: [], slack: [], discord: [] },
          },
        ],
      })) as Response,
    );
    render(<InjectUserModal persona="# x\n" onClose={() => undefined} onInject={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /email/ })).toBeTruthy());
    expect(screen.getByRole("checkbox", { name: /email/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: /display name/ })).toHaveProperty("disabled", false);
  });
});
