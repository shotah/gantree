import { denyUnlessCraneRead, withDoor } from "@/lib/yard/door";
import { sampleHost, sampleMcp, sampleTurns, sampleUptime } from "@/lib/yard/observe/stats";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const [host, turns, mcp, uptime] = await Promise.all([
    sampleHost(slug),
    sampleTurns(slug),
    sampleMcp(slug),
    sampleUptime(slug),
  ]);
  return Response.json({ host, turns, mcp, uptime });
});
