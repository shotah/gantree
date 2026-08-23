import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultFieldSelection,
  injectOperatorIntoPersona,
  operatorFieldValue,
  type PersonaOperator,
} from "@/lib/yard/crane/injectPersona";
import { personaMarkdown } from "@/lib/yard/crane/seed";

const ada: PersonaOperator = {
  displayName: "Ada",
  email: "ada@example.com",
  description: "likes rye jokes",
  channels: { telegram: ["99"], slack: ["U012ABCDEF"], discord: [] },
};

describe("injectOperatorIntoPersona", () => {
  it("fills About you from the seed template and leaves Identity as the agent", () => {
    const seeded = personaMarkdown("kit");
    expect(seeded).toContain("- **Name:** Kit");
    expect(seeded).toContain("- **Name:** Your Name");

    const next = injectOperatorIntoPersona(seeded, ada, ["displayName", "email", "telegram"]);
    expect(next).toContain("- **Name:** Kit");
    expect(next).toContain("- **Name:** Ada");
    expect(next).not.toContain("- **Name:** Your Name");
    expect(next).toContain("- **Google / Workspace email (canonical):** ada@example.com");
    expect(next).toContain("- **Telegram id:** 99");
    expect(next).toContain("- **Telegram pin:");
    expect(next).toMatch(/## Identity[\s\S]*- \*\*Name:\*\* Kit[\s\S]*## About you[\s\S]*- \*\*Name:\*\* Ada/);
  });

  it("appends About you when the file has none", () => {
    const next = injectOperatorIntoPersona("# kit\n\nA long-horizon personal agent.\n", ada, ["displayName", "email"]);
    expect(next).toContain("# kit");
    expect(next).toContain("## About you");
    expect(next).toContain("- **Name:** Ada");
    expect(next).toContain("- **Google / Workspace email (canonical):** ada@example.com");
  });

  it("skips empty fields and does not invent Telegram pin", () => {
    const next = injectOperatorIntoPersona(personaMarkdown("kit"), ada, ["discord", "description"]);
    expect(next).toContain("- **Notes:** likes rye jokes");
    expect(next).not.toContain("Telegram id");
    expect(next).toContain("- **Telegram pin:");
  });

  it("no-ops when nothing selected has a value", () => {
    const seeded = personaMarkdown("kit");
    expect(injectOperatorIntoPersona(seeded, ada, ["discord"])).toBe(seeded);
  });

  it("default selection is non-empty fields minus preferred address", () => {
    expect(defaultFieldSelection(ada)).toEqual(["displayName", "email", "description", "telegram", "slack"]);
    expect(operatorFieldValue(ada, "preferredAddress")).toBe("Ada");
  });

  it("still matches the on-disk PERSONA.example.md About you labels", () => {
    const example = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../lib/yard/crane/templates/PERSONA.example.md"),
      "utf8",
    );
    expect(example).toContain("## About you");
    expect(example).toContain("- **Google / Workspace email (canonical):** you@example.com");
    const next = injectOperatorIntoPersona(example, ada, ["email"]);
    expect(next).toContain("- **Google / Workspace email (canonical):** ada@example.com");
    expect(next).toContain("- **Name:** (pick one)");
  });
});
