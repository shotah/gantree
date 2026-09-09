import { denyUnlessCraneMutate, denyUnlessCraneRead, recordFromRequest, withDoor } from "@/lib/yard/door";
import { pendantSnapshot, saveGantryPendantAllowlist } from "@/lib/yard/crane/pendant";
import { rotatePendantBearer } from "@/lib/yard/pendant/channel";

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

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as { op?: string; confirm?: unknown };
  if (body.op !== "rotate") {
    return Response.json({ error: "unknown op" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return Response.json({ error: "confirm required" }, { status: 400 });
  }
  const result = await rotatePendantBearer(slug);
  if (result.ok) {
    recordFromRequest(req, "pendant.bearer", slug, "rotated");
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
});
