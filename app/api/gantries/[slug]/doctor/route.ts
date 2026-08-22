import { doctor } from "@/lib/yard/doctor";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const report = await doctor(slug);
  if (!report) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(report);
}
