import { run, type RunAction } from "@/lib/yard/run";

const ACTIONS = new Set<RunAction>(["start", "stop", "recreate", "backup", "pin"]);

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; image?: string };
  const action = body.action as RunAction | undefined;
  if (!action || !ACTIONS.has(action)) {
    return Response.json({ error: "action must be start|stop|recreate|backup|pin" }, { status: 400 });
  }
  const result = await run(slug, action, body.image);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
