/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HintField } from "@/app/components/shared/HintField";

afterEach(() => {
  cleanup();
});

describe("HintField", () => {
  it("keeps a short accessible name and describes with hint plus example", () => {
    render(
      <HintField label="bot token" hint="from @BotFather after /newbot" example="123456789:AAHxxx">
        <input type="password" />
      </HintField>,
    );
    const input = screen.getByLabelText("bot token");
    const tipId = input.getAttribute("aria-describedby");
    expect(tipId).toBeTruthy();
    const tip = document.getElementById(tipId ?? "");
    expect(tip?.textContent).toContain("from @BotFather after /newbot");
    expect(tip?.textContent).toContain("e.g. 123456789:AAHxxx");
    expect(input.closest("[class*='group/hint']")).toBeTruthy();
  });
});
