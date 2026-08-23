import { canMutateCrane, denyUnlessCraneRead, operatorFromRequest, withDoor } from "@/lib/yard/door";
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
