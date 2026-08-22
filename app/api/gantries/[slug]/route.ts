import { getGantry } from "@/lib/yard/inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const gantry = await getGantry(slug);
  if (!gantry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(gantry);
}
