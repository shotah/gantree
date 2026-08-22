import { sampleHost, sampleMcp, sampleTurns, sampleUptime } from "@/lib/yard/stats";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [host, turns, mcp, uptime] = await Promise.all([
    sampleHost(slug),
    sampleTurns(slug),
    sampleMcp(slug),
    sampleUptime(slug),
  ]);
  return Response.json({ host, turns, mcp, uptime });
}
