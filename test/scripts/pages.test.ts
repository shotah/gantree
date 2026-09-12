import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error scripts/*.mjs sits outside the TS project
import { DOC_PAGES } from "../../scripts/pages.mjs";

describe("DOC_PAGES", () => {
  it("lists markdown that exists under docs/", () => {
    expect(DOC_PAGES.some((p: { file: string }) => p.file === "protections.md")).toBe(true);
    expect(DOC_PAGES.some((p: { file: string }) => p.file === "channel_migration_doc.md")).toBe(true);
    for (const page of DOC_PAGES as { file: string; nav: string }[]) {
      expect(existsSync(join("docs", page.file))).toBe(true);
      expect(page.nav.length).toBeGreaterThan(0);
    }
  });
});

describe("site pitch", () => {
  it("names the three-repo household", () => {
    const home = readFileSync("site/home.html", "utf8");
    expect(home).toContain("Three repos");
    expect(home).toContain("ai-gantry");
    expect(home).toContain("gantry-pendant");
    expect(home).toContain("Default mouth is the pendant");
    expect(home).toContain("never a hop");
  });
});
