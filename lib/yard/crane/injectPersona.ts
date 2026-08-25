import type { OperatorChannels } from "@/lib/yard/door/channels";

export type PersonaOperator = {
  displayName: string;
  email: string;
  description: string;
  timezone: string;
  location: string;
  channels: OperatorChannels;
};

export const PERSONA_OPERATOR_FIELDS = [
  { key: "displayName", label: "display name", personaLabel: "Name" },
  { key: "preferredAddress", label: "preferred address", personaLabel: "Preferred address" },
  { key: "email", label: "email", personaLabel: "Google / Workspace email (canonical)" },
  { key: "location", label: "location", personaLabel: "Location" },
  { key: "timezone", label: "timezone", personaLabel: "Timezone" },
  { key: "description", label: "description", personaLabel: "Notes" },
  { key: "telegram", label: "Telegram id", personaLabel: "Telegram id" },
  { key: "slack", label: "Slack id", personaLabel: "Slack id" },
  { key: "discord", label: "Discord id", personaLabel: "Discord id" },
] as const;

export type PersonaOperatorField = (typeof PERSONA_OPERATOR_FIELDS)[number]["key"];

export function operatorFieldValue(op: PersonaOperator, key: PersonaOperatorField): string {
  switch (key) {
    case "displayName":
    case "preferredAddress":
      return op.displayName.trim();
    case "email":
      return op.email.trim();
    case "location":
      return op.location.trim();
    case "timezone":
      return op.timezone.trim();
    case "description":
      return op.description.trim().replace(/\s+/g, " ");
    case "telegram":
      return op.channels.telegram.filter(Boolean).join(", ");
    case "slack":
      return op.channels.slack.filter(Boolean).join(", ");
    case "discord":
      return op.channels.discord.filter(Boolean).join(", ");
  }
}

/** Fields that have a value, minus preferred address (same source as display name). */
export function defaultFieldSelection(op: PersonaOperator): PersonaOperatorField[] {
  return PERSONA_OPERATOR_FIELDS.filter((f) => f.key !== "preferredAddress" && operatorFieldValue(op, f.key)).map(
    (f) => f.key,
  );
}

/**
 * Patch **About you** only. Identity (the agent's name) is left alone.
 * Missing About you: append a section. Empty selected values: no-op.
 */
export function injectOperatorIntoPersona(
  markdown: string,
  op: PersonaOperator,
  fields: readonly PersonaOperatorField[],
): string {
  const patches: { label: string; value: string }[] = [];
  for (const key of fields) {
    const meta = PERSONA_OPERATOR_FIELDS.find((f) => f.key === key);
    const value = operatorFieldValue(op, key);
    if (meta && value) {
      patches.push({ label: meta.personaLabel, value });
    }
  }
  if (patches.length === 0) {
    return markdown;
  }

  const split = splitAboutYou(markdown);
  let section = split.found ? split.about : "## About you\n";
  for (const p of patches) {
    section = setBullet(section, p.label, p.value);
  }
  section = section.replace(/\s*$/, "\n");

  if (!split.found) {
    const body = markdown.replace(/\s*$/, "");
    return body ? `${body}\n\n${section}` : section;
  }
  const head = split.before.replace(/\s*$/, "");
  const tail = split.after.replace(/^\n*/, "").replace(/\s*$/, "");
  const mid = `${head ? `${head}\n` : ""}${section}`;
  return tail ? `${mid}\n${tail}\n` : mid;
}

function splitAboutYou(markdown: string): { before: string; about: string; after: string; found: boolean } {
  const lines = markdown.split("\n");
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^## About you\s*$/i.test(lines[i] ?? "")) {
      start = i;
      continue;
    }
    if (start >= 0 && i > start && /^## /.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  if (start < 0) {
    return { before: markdown, about: "", after: "", found: false };
  }
  return {
    before: lines.slice(0, start).join("\n"),
    about: lines.slice(start, end).join("\n"),
    after: lines.slice(end).join("\n"),
    found: true,
  };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setBullet(section: string, label: string, value: string): string {
  const re = new RegExp(`^(- \\*\\*${escapeReg(label)}:\\*\\*)\\s*.*$`, "m");
  const line = `- **${label}:** ${value}`;
  if (re.test(section)) {
    return section.replace(re, line);
  }
  return `${section.replace(/\s*$/, "")}\n${line}`;
}
