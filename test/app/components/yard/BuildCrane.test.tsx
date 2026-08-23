/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildCrane } from "@/app/components/yard/BuildCrane";

vi.mock("@/app/lib/yardFetch", () => ({
  yardFetch: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("BuildCrane", () => {
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
});
