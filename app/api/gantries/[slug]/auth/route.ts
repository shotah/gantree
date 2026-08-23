import { denyUnlessCraneMutate, withDoor } from "@/lib/yard/door";
import { loadCatalog } from "@/lib/yard/tools/catalog";
import { exchangeAuth, kickAuth, waitAuth } from "@/lib/yard/tools/auth";

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const body = (await req.json()) as { server?: string; op?: "start" | "exchange" | "wait"; code?: string };
  if (!body.server) {
    return Response.json({ error: "server required" }, { status: 400 });
  }
  const flow = loadCatalog().find((c) => c.name === body.server)?.authFlow;
  const op = body.op ?? "start";
  const result
    = op === "exchange"
      ? await exchangeAuth(slug, body.server, body.code ?? "", flow)
      : op === "wait"
        ? await waitAuth(slug, body.server)
        : await kickAuth(slug, body.server, flow);
  return Response.json(result, { status: result.ok ? 200 : 400 });
});
