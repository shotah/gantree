import { denyUnlessCraneRead, listOperators, withDoor } from "@/lib/yard/door";
import { loadCraneEnv } from "@/lib/yard/crane/envscan";
import { parsePendantAllowlist } from "@/lib/yard/crane/pendantShape";
import { namesFromOperators, suggestStoreGoogleSub } from "@/lib/yard/observe/spend";
import { sampleHost, sampleMcp, sampleTurns, sampleUptime } from "@/lib/yard/observe/stats";
import { loadObservePrefs } from "@/lib/yard/observe/prefs";

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
  const operators = listOperators();
  const env = loadCraneEnv(slug);
  const storeSub = suggestStoreGoogleSub(
    turns.map((t) => t.userId).filter((id): id is string => Boolean(id)),
    parsePendantAllowlist(env.PENDANT_ALLOWED_USERS),
    operators,
  );
  return Response.json({
    host,
    turns,
    mcp,
    uptime,
    userNames: namesFromOperators(operators),
    observe: loadObservePrefs(),
    storeSub,
  });
});
