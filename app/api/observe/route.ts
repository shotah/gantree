import { denyUnlessAdmin, operatorFromRequest, recordFromRequest, withDoor } from "@/lib/yard/door";
import { pruneByObservePrefs } from "@/lib/yard/observe/memory";
import { loadObservePrefs, saveObservePrefs } from "@/lib/yard/observe/prefs";

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ observe: loadObservePrefs() });
});

export const PUT = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.confirm !== true) {
    return Response.json({ error: "confirm required" }, { status: 400 });
  }
  const saved = saveObservePrefs(body);
  if (!saved.ok) {
    return Response.json({ error: saved.error }, { status: 400 });
  }
  pruneByObservePrefs();
  recordFromRequest(req, "inventory", null, "observe");
  return Response.json({ ok: true, observe: saved.prefs });
});
