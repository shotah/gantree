import { listYard } from "@/lib/yard/inventory";
import { buildCrane, type BuildInput } from "@/lib/yard/build";
import { kickYardSamples, peekYardSpend, sampleTurns } from "@/lib/yard/stats";

export async function GET() {
  try {
    const yard = await listYard();
    const slugs = yard.gantries.map((g) => g.slug);
    const running = yard.gantries.filter((g) => g.state === "running").map((g) => g.slug);
    await Promise.all(slugs.map((s) => sampleTurns(s).catch(() => [])));
    return Response.json({
      ...yard,
      sparks: kickYardSamples(running),
      spend: peekYardSpend(slugs),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as BuildInput;
  const result = await buildCrane(body);
  return Response.json(result, { status: result.ok ? 201 : 400 });
}
