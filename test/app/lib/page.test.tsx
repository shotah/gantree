/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_AUTH, PAGE_HEADER, PAGE_MAIN } from "@/app/lib/page";
import LoginPage from "@/app/login/page";
import SetupPage from "@/app/setup/page";

afterEach(() => {
  cleanup();
});

describe("page width", () => {
  it("caps the logged-in column so every page shares one edge", () => {
    expect(PAGE_MAIN).toMatch(/max-w-screen-2xl/);
    expect(PAGE_HEADER).toMatch(/max-w-screen-2xl/);
    expect(PAGE_MAIN).toMatch(/mx-auto/);
    expect(PAGE_HEADER).toMatch(/mx-auto/);
  });

  it("keeps login and setup as a narrow form", () => {
    expect(PAGE_AUTH).toMatch(/max-w-sm/);
    expect(PAGE_AUTH).toMatch(/mx-auto/);
  });

  it("puts the login cap on an inner column, not main", () => {
    render(<LoginPage />);
    const main = screen.getByRole("main");
    expect(main.className).toBe("min-w-0");
    expect(main.firstElementChild?.className).toMatch(/max-w-sm/);
    expect(main.firstElementChild?.className).toMatch(/mx-auto/);
  });

  it("puts the setup cap on an inner column, not main", () => {
    render(<SetupPage />);
    const main = screen.getByRole("main");
    expect(main.className).toBe("min-w-0");
    expect(main.firstElementChild?.className).toMatch(/max-w-sm/);
    expect(main.firstElementChild?.className).toMatch(/mx-auto/);
  });
});
