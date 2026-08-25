import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readText, writeText } from "../host/files";

/** Canonical seed from ai-gantry `examples/persona`. Keep the files in lockstep; strip operator notes on handoff. */
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
  return forAgent(PERSONA_EXAMPLE.replace("- **Name:** (pick one)", `- **Name:** ${name}`));
}

export function selfMarkdown(): string {
  return forAgent(SELF_EXAMPLE.split("\n").filter((line) => !selfPlaceholder(line)).join("\n"));
}

function selfPlaceholder(line: string): boolean {
  const t = line.trim();
  return /^-\s*\(.*\)\s*$/.test(t) || /stamps the header/i.test(t);
}

/** Drop install/stamp folklore. Keep Self-notes / Location pins headings for the harness upsert. */
function forAgent(markdown: string): string {
  const heading = markdown.search(/^## /m);
  const head = heading >= 0 ? markdown.slice(0, heading) : markdown;
  const rest = heading >= 0 ? markdown.slice(heading) : "";
  const cleanedHead = head
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  const cleanedRest = rest
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^<!--/.test(t) && /-->$/.test(t)) {
        return false;
      }
      return !/^Harness overwrites this section on boot\.?$/i.test(t);
    })
    .join("\n");
  return (cleanedHead + cleanedRest).replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
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
