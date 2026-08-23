import { withDoor } from "@/lib/yard/door";
import { listYard } from "@/lib/yard/crane/inventory";
import { buildCrane, type BuildInput } from "@/lib/yard/crane/build";
import { parseSpendWindow, windowStart } from "@/lib/yard/observe/spend";
import { kickYardSamples, peekYardSpend, sampleTurns } from "@/lib/yard/observe/stats";

export const GET = withDoor(async (req: Request) => {
  try {
    const window = parseSpendWindow(new URL(req.url).searchParams.get("window"));
    const yard = await listYard();
    const slugs = yard.gantries.map((g) => g.slug);
    const running = yard.gantries.filter((g) => g.state === "running").map((g) => g.slug);
    await Promise.all(slugs.map((s) => sampleTurns(s).catch(() => [])));
    return Response.json({
      ...yard,
      sparks: kickYardSamples(running),
      spend: peekYardSpend(slugs, windowStart(window)),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});

export const POST = withDoor(async (req: Request) => {
  const body = (await req.json()) as BuildInput;
  const result = await buildCrane(body);
  return Response.json(result, { status: result.ok ? 201 : 400 });
});
