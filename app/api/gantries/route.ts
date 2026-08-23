import { canBuildCrane, denyUnlessAdmin, listOperators, operatorFromRequest, scopeYard, withDoor } from "@/lib/yard/door";
import { listYard } from "@/lib/yard/crane/inventory";
import { buildCrane, type BuildInput } from "@/lib/yard/crane/build";
import { peekMachine, sampleMachine } from "@/lib/yard/observe/machine";
import { labelSpend, namesFromOperators, parseSpendWindow, windowStart } from "@/lib/yard/observe/spend";
import { kickYardSamples, peekYardSpend, sampleTurns } from "@/lib/yard/observe/stats";

export const GET = withDoor(async (req: Request) => {
  try {
    const you = operatorFromRequest(req);
    const window = parseSpendWindow(new URL(req.url).searchParams.get("window"));
    const listed = await listYard();
    const yard = you ? scopeYard(listed, you) : listed;
    const slugs = yard.gantries.map((g) => g.slug);
    const running = yard.gantries.filter((g) => g.state === "running").map((g) => g.slug);
    const craneNames = yard.gantries.map((g) => g.containerName);
    await Promise.all([
      ...slugs.map((s) => sampleTurns(s).catch(() => [])),
      sampleMachine(craneNames).catch(() => null),
    ]);
    const userNames = namesFromOperators(listOperators());
    return Response.json({
      ...yard,
      sparks: kickYardSamples(running),
      spend: labelSpend(peekYardSpend(slugs, windowStart(window)), userNames),
      host: peekMachine(),
      userNames,
      canBuild: Boolean(you && canBuildCrane(you)),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});

export const POST = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const body = (await req.json()) as BuildInput;
  const result = await buildCrane(body);
  return Response.json(result, { status: result.ok ? 201 : 400 });
});
