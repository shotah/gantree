/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoginForm, SetupForm } from "@/app/components/operators/AuthForms";

afterEach(() => {
  cleanup();
});

describe("AuthForms", () => {
  it("says the board is not the chat", () => {
    render(<LoginForm />);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
    expect(screen.getByText(/The board is not the chat/)).toBeTruthy();
    expect(screen.queryByText(/Chat still stays Telegram/)).toBeNull();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
  });

  it("setup still names the first operator", () => {
    render(<SetupForm />);
    expect(screen.getByRole("heading", { name: "First operator" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create operator" })).toBeTruthy();
  });
});
