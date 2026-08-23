import { canManageOperators, operatorFromRequest, withDoor } from "@/lib/yard/door";
import { listYard } from "@/lib/yard/crane/inventory";
import { consoleRuntime } from "@/lib/yard/host/runtime";
import { peekMachine, sampleMachine } from "@/lib/yard/observe/machine";
import { loadObservePrefs } from "@/lib/yard/observe/prefs";

export const GET = withDoor(async (req: Request) => {
  try {
    const you = operatorFromRequest(req);
    const listed = await listYard();
    await sampleMachine(listed.gantries.map((g) => g.containerName)).catch(() => null);
    const host = peekMachine();
    const admin = Boolean(you && canManageOperators(you));
    return Response.json({
      host,
      dockerError: listed.dockerError,
      yard: listed.yard,
      source: listed.source,
      canMutate: admin,
      runtime: admin ? consoleRuntime(host.live?.hostname) : null,
      observe: loadObservePrefs(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});
