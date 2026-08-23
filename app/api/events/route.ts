import { denyUnlessCraneRead, listYardEvents, operatorFromRequest, withDoor } from "@/lib/yard/door";
import type { YardEvent } from "@/lib/yard/types";

function eventsResponse(events: YardEvent[], format: string | null): Response {
  if (format === "jsonl") {
    const body = events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": 'attachment; filename="yard-events.jsonl"',
      },
    });
  }
  return Response.json({ events });
}

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const kind = url.searchParams.get("kind") || undefined;
  const format = url.searchParams.get("format");
  const limit = Number(url.searchParams.get("limit") || "40");
  const cap = Number.isFinite(limit) ? limit : 40;
  const includeSession = you?.role === "admin";
  if (you && you.role !== "admin") {
    if (you.cranes.length === 0) {
      return eventsResponse([], format);
    }
    if (slug) {
      const denied = denyUnlessCraneRead(req, slug);
      if (denied) {
        return denied;
      }
      return eventsResponse(listYardEvents({ slug, kind, limit: cap, includeSession }), format);
    }
    return eventsResponse(listYardEvents({ slugs: you.cranes, kind, limit: cap, includeSession }), format);
  }
  return eventsResponse(listYardEvents({ slug, kind, limit: cap, includeSession }), format);
});
