import { denyUnlessCraneRead, withDoor } from "@/lib/yard/door";
import { doctor } from "@/lib/yard/crane/doctor";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const report = await doctor(slug);
  if (!report) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(report);
});
