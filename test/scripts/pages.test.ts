import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error scripts/*.mjs sits outside the TS project
import { DOC_PAGES } from "../../scripts/pages.mjs";

describe("DOC_PAGES", () => {
  it("lists markdown that exists under docs/", () => {
    expect(DOC_PAGES.some((p: { file: string }) => p.file === "protections.md")).toBe(true);
    for (const page of DOC_PAGES as { file: string; nav: string }[]) {
      expect(existsSync(join("docs", page.file))).toBe(true);
      expect(page.nav.length).toBeGreaterThan(0);
    }
  });
});
