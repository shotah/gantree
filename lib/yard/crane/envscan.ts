import { resolve } from "node:path";
import { parseAllowlist } from "../host/telegram";
import { loadEnvFile } from "../host/envfile";
import { loadGantreeToml, yardRoot } from "../host/files";
import { parsePendantAllowlist } from "./pendantShape";

export type MouthHold = { slug: string; kind: "pendant" | "telegram" };

export function listCraneEnvs(): { slug: string; env: Record<string, string> }[] {
  const doc = loadGantreeToml();
  return (doc?.gantry ?? []).map((row) => ({
    slug: row.slug,
    env: loadEnvFile(row.env_file ? resolve(yardRoot(), row.env_file) : null),
  }));
}

export function loadCraneEnv(slug: string): Record<string, string> {
  return listCraneEnvs().find((c) => c.slug === slug)?.env ?? {};
}

/** Cranes whose mouth allowlists still carry this operator's ids or email. */
export function cranesHoldingOperator(op: {
  email?: string;
  channels: { telegram: string[]; google: string[] };
}): MouthHold[] {
  const email = (op.email ?? "").trim().toLowerCase();
  const telegram = new Set(op.channels.telegram.filter(Boolean));
  const google = new Set(op.channels.google.filter(Boolean));
  const hits: MouthHold[] = [];
  for (const { slug, env } of listCraneEnvs()) {
    const tg = parseAllowlist(env.TELEGRAM_ALLOWED_USERS);
    if (tg.some((id) => telegram.has(id))) {
      hits.push({ slug, kind: "telegram" });
    }
    const pendant = parsePendantAllowlist(env.PENDANT_ALLOWED_USERS);
    const held = pendant.some(
      (e) => (e.sub && google.has(e.sub)) || (e.email && email && e.email === email),
    );
    if (held) {
      hits.push({ slug, kind: "pendant" });
    }
  }
  return hits;
}
