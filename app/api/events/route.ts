import { listYardEvents, withDoor } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const limit = Number(url.searchParams.get("limit") || "40");
  return Response.json({ events: listYardEvents({ slug, limit: Number.isFinite(limit) ? limit : 40 }) });
});
