import { denyUnlessCraneMutate, denyUnlessCraneRead, recordFromRequest, withDoor } from "@/lib/yard/door";
import { pendantSnapshot, saveGantryPendantAllowlist } from "@/lib/yard/crane/pendant";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const snap = await pendantSnapshot(slug);
  if (!snap) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(snap);
});

export const PUT = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as { entries?: string[] | string };
  const entries = Array.isArray(body.entries)
    ? body.entries
    : typeof body.entries === "string"
      ? body.entries.split(/[,\s]+/)
      : [];
  const result = await saveGantryPendantAllowlist(slug, entries);
  if (result.ok) {
    recordFromRequest(req, "pendant.allowlist", slug, `${result.allowlist.length}`);
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
});
