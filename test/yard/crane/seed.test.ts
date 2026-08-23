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
    expect(text).toContain("self_note");
    expect(text).toContain("Seeded from ai-gantry PERSONA.example.md.");
    expect(selfMarkdown()).toContain("Who You Are Becoming");
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
