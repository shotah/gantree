import { yardDb } from "./store";
import { operatorFromRequest } from "./gate";
import type { YardEvent } from "../types";

const EVENT_CAP = 2000;

/** Door session events. Listed only for admin — not crane-scoped. */
export const SESSION_EVENT_KINDS = ["login", "logout"] as const;

export type RecordEventInput = {
  kind: string;
  slug?: string | null;
  operatorId?: string | null;
  detail?: string;
};

export function recordYardEvent(input: RecordEventInput): void {
  const db = yardDb();
  db.prepare(
    "INSERT INTO yard_event (at, kind, slug, operator_id, detail) VALUES (?, ?, ?, ?, ?)",
  ).run(
    new Date().toISOString(),
    input.kind,
    input.slug ?? null,
    input.operatorId ?? null,
    input.detail ?? "",
  );
  const n = Number((db.prepare("SELECT COUNT(*) AS n FROM yard_event").get() as { n: number } | undefined)?.n ?? 0);
  if (n > EVENT_CAP) {
    db.prepare(
      "DELETE FROM yard_event WHERE id IN (SELECT id FROM yard_event ORDER BY id ASC LIMIT ?)",
    ).run(n - EVENT_CAP);
  }
}

export function recordFromRequest(req: Request, kind: string, slug?: string | null, detail?: string): void {
  recordYardEvent({
    kind,
    slug,
    operatorId: operatorFromRequest(req)?.id ?? null,
    detail,
  });
}

export function listYardEvents(opts?: {
  slug?: string;
  slugs?: string[];
  kind?: string;
  limit?: number;
  includeSession?: boolean;
  /** Inclusive lower bound on `at` (epoch ms). */
  since?: number | null;
}): YardEvent[] {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 200);
  const slugs = opts?.slugs?.filter(Boolean) ?? [];
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts?.slug) {
    where.push("e.slug = ?");
    args.push(opts.slug);
  } else if (slugs.length > 0) {
    where.push(`e.slug IN (${slugs.map(() => "?").join(",")})`);
    args.push(...slugs);
  }
  if (opts?.kind) {
    where.push("e.kind = ?");
    args.push(opts.kind);
  }
  if (opts?.includeSession === false) {
    where.push(`e.kind NOT IN (${SESSION_EVENT_KINDS.map(() => "?").join(",")})`);
    args.push(...SESSION_EVENT_KINDS);
  }
  if (opts?.since != null) {
    where.push("e.at >= ?");
    args.push(new Date(opts.since).toISOString());
  }
  const sql = `SELECT e.id, e.at, e.kind, e.slug, e.operator_id, e.detail, o.name AS operator_name
           FROM yard_event e
           LEFT JOIN operator o ON o.id = e.operator_id
           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
           ORDER BY e.id DESC
           LIMIT ?`;
  args.push(limit);
  return mapEvents(yardDb().prepare(sql).all(...args) as EventRow[]);
}

function mapEvents(rows: EventRow[]): YardEvent[] {
  return rows.map(fromRow);
}

type EventRow = {
  id: number;
  at: string;
  kind: string;
  slug: string | null;
  operator_id: string | null;
  detail: string;
  operator_name: string | null;
};

function fromRow(row: EventRow): YardEvent {
  return {
    id: Number(row.id),
    at: row.at,
    kind: row.kind,
    slug: row.slug,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    detail: row.detail,
  };
}
