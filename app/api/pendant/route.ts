import { denyUnlessAdmin, recordFromRequest, withDoor } from "@/lib/yard/door";
import {
  parsePendantSettingsPatch,
  pendantSettingsView,
  savePendantSettings,
} from "@/lib/yard/pendant/settings";

export const GET = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  return Response.json({ pendant: pendantSettingsView() });
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
  const parsed = parsePendantSettingsPatch(body);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const saved = await savePendantSettings(parsed);
  if (saved.ok) {
    recordFromRequest(req, "pendant.settings", null, saved.detail);
  }
  return Response.json(
    { ok: saved.ok, detail: saved.detail, pendant: saved.pendant },
    { status: saved.ok ? 200 : 400 },
  );
});
