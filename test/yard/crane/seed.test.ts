import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { displayName, personaMarkdown, seedPersonaFiles, selfMarkdown } from "@/lib/yard/crane/seed";

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("persona seed", () => {
  it("fills Identity from the slug and keeps About you as a placeholder", () => {
    const text = personaMarkdown("noodles");
    expect(displayName("noodles")).toBe("Noodles");
    expect(text).toContain("- **Name:** Noodles");
    expect(text).not.toContain("(pick one)");
    expect(text).toContain("- **Name:** Your Name");
    expect(text).toContain("## Voice");
    expect(text).toContain("## Directives");
    expect(text).toContain("Prefer parallel tool calls");
    expect(text).toContain("Independent lookups");
    expect(text).toContain("pref/hours");
    expect(text).toContain("pref/calendar");
    expect(text).toContain("yes boss");
    expect(text).toContain("empty calendar");
    expect(text).toContain("self_note");
    expect(text).toContain("memory_store");
    expect(text).toContain("mcp_enable");
    expect(text).toContain("Review `[mcp prefixes]` on vs off");
    expect(selfMarkdown()).toContain("Who You Are Becoming");
  });

  it("drops operator/harness callouts so they are not handed to the model", () => {
    const text = personaMarkdown("kit");
    expect(text).not.toContain("make init");
    expect(text).not.toContain("Seeded from");
    expect(text).not.toContain("Harness overwrites");
    expect(text).not.toContain("agent-written");
    expect(text).not.toContain("<!--");
    expect(text).toContain("## Self-notes");
    expect(text).toContain("## Location pins");
    expect(text).toContain("## Directives");
    expect(text).toContain("north-star");
    expect(selfMarkdown()).not.toMatch(/bullets only|stamps the header/i);
  });

  it("writes both files into an empty persona dir", () => {
    const dir = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(dir);
    const personaDir = join(dir, "persona");
    mkdirSync(personaDir);
    seedPersonaFiles(personaDir, "kit");
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toContain("**Name:** Kit");
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toContain("Who You Are Becoming");
  });

  it("does not replace PERSONA.md or SELF.md that already exist, even if short", () => {
    const dir = mkdtempSync(join(process.cwd(), ".tmp-"));
    dirs.push(dir);
    const personaDir = join(dir, "persona");
    mkdirSync(personaDir);
    writeFileSync(join(personaDir, "PERSONA.md"), "# kit\n\nA long-horizon personal agent.\n");
    writeFileSync(join(personaDir, "SELF.md"), "- likes rye jokes\n");
    seedPersonaFiles(personaDir, "kit", { persona: "# overwritten?\n" });
    expect(readFileSync(join(personaDir, "PERSONA.md"), "utf8")).toBe("# kit\n\nA long-horizon personal agent.\n");
    expect(readFileSync(join(personaDir, "SELF.md"), "utf8")).toBe("- likes rye jokes\n");
  });
});
