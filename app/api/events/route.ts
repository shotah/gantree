import { denyUnlessCraneRead, listYardEvents, operatorFromRequest, withDoor } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const limit = Number(url.searchParams.get("limit") || "40");
  const cap = Number.isFinite(limit) ? limit : 40;
  if (you && you.role !== "admin") {
    if (you.cranes.length === 0) {
      return Response.json({ events: [] });
    }
    if (slug) {
      const denied = denyUnlessCraneRead(req, slug);
      if (denied) {
        return denied;
      }
      return Response.json({ events: listYardEvents({ slug, limit: cap }) });
    }
    return Response.json({ events: listYardEvents({ slugs: you.cranes, limit: cap }) });
  }
  return Response.json({ events: listYardEvents({ slug, limit: cap }) });
});
