import { withDoor } from "@/lib/yard/door";
import { getGantry } from "@/lib/yard/crane/inventory";

export const GET = withDoor(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const gantry = await getGantry(slug);
  if (!gantry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(gantry);
});
