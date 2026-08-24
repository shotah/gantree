import { describe, expect, it } from "vitest";
import { PAGE_AUTH, PAGE_HEADER, PAGE_MAIN } from "@/app/lib/page";

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
});
