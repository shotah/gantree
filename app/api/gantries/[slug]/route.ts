import { canMutateCrane, denyUnlessCraneMutate, denyUnlessCraneRead, operatorFromRequest, recordFromRequest, withDoor } from "@/lib/yard/door";
import { destroyCrane } from "@/lib/yard/crane/destroy";
import { getGantry } from "@/lib/yard/crane/inventory";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const gantry = await getGantry(slug);
  if (!gantry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const you = operatorFromRequest(req);
  return Response.json({ ...gantry, canMutate: Boolean(you && canMutateCrane(you, slug)) });
});

export const DELETE = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as { removeFiles?: boolean };
  const result = await destroyCrane(slug, { removeFiles: body.removeFiles === true });
  if (result.ok) {
    recordFromRequest(req, "destroy", slug, result.detail);
  }
  const status = result.ok ? 200 : result.detail.startsWith("unknown gantry") ? 404 : 400;
  return Response.json(result, { status });
});
