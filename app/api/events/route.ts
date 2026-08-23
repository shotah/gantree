import { denyUnlessCraneRead, listYardEvents, operatorFromRequest, withDoor } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  const url = new URL(req.url);
  let slug = url.searchParams.get("slug") || undefined;
  const limit = Number(url.searchParams.get("limit") || "40");
  if (you?.role === "user") {
    if (slug && slug !== you.crane) {
      const denied = denyUnlessCraneRead(req, slug);
      if (denied) {
        return denied;
      }
    }
    slug = you.crane ?? undefined;
    if (!slug) {
      return Response.json({ events: [] });
    }
  }
  return Response.json({ events: listYardEvents({ slug, limit: Number.isFinite(limit) ? limit : 40 }) });
});
