import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readText, writeText } from "../host/files";

/** Canonical seed from ai-gantry `examples/persona` (`gantry init`). Keep in lockstep. */
const here = dirname(fileURLToPath(import.meta.url));
const PERSONA_EXAMPLE = readFileSync(join(here, "templates", "PERSONA.example.md"), "utf8");
const SELF_EXAMPLE = readFileSync(join(here, "templates", "SELF.example.md"), "utf8");

export function displayName(slug: string): string {
  const s = slug.trim();
  if (!s) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function personaMarkdown(slug: string): string {
  const name = displayName(slug);
  return PERSONA_EXAMPLE.replace("- **Name:** (pick one)", `- **Name:** ${name}`).replace(
    "Copy via `make init`.",
    "Seeded from ai-gantry PERSONA.example.md.",
  );
}

export function selfMarkdown(): string {
  return SELF_EXAMPLE;
}

function withNl(body: string): string {
  return body.endsWith("\n") ? body : `${body}\n`;
}

/**
 * Write PERSONA.md + SELF.md only when those files are missing (new crane).
 * Recreate, rebuild, and GET never replace an existing file.
 */
export function seedPersonaFiles(personaDir: string, slug: string, opts?: { persona?: string }): void {
  const personaPath = resolve(personaDir, "PERSONA.md");
  const selfPath = resolve(personaDir, "SELF.md");
  if (readText(personaPath) == null) {
    const custom = opts?.persona?.trim();
    writeText(personaPath, withNl(custom || personaMarkdown(slug)));
  }
  if (readText(selfPath) == null) {
    writeText(selfPath, selfMarkdown());
  }
}
