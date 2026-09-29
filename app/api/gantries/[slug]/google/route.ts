import { denyUnlessCraneMutate, recordFromRequest, withDoor } from "@/lib/yard/door";
import { getGantry } from "@/lib/yard/crane/inventory";
import {
  clearGoogleDefaultIf,
  listGoogleAccounts,
  removeGoogleAccount,
  setGoogleDefault,
} from "@/lib/yard/tools/googleAccounts";

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const g = await getGantry(slug);
  if (!g) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (!g.dataDir) {
    return Response.json({ error: "no data_dir" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { op?: string; email?: string | null };
  const email = typeof body.email === "string" ? body.email : null;
  if (body.op === "remove") {
    if (!email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    const removed = removeGoogleAccount(g.dataDir, email);
    if (!removed.ok) {
      return Response.json({ error: removed.error }, { status: 400 });
    }
    const cleared = clearGoogleDefaultIf(g.envFile, email);
    const accounts = listGoogleAccounts(g.dataDir);
    recordFromRequest(req, "google-account", slug, `removed ${email.trim().toLowerCase()}`);
    return Response.json({
      ok: true,
      accounts,
      recreate: cleared,
      detail: cleared
        ? `removed ${email.trim().toLowerCase()} and cleared USER_GOOGLE_EMAIL — recreate to apply`
        : `removed ${email.trim().toLowerCase()}`,
    });
  }
  if (body.op === "default") {
    if (!g.envFile) {
      return Response.json({ error: "no env_file" }, { status: 400 });
    }
    const accounts = listGoogleAccounts(g.dataDir);
    const set = setGoogleDefault(g.envFile, email, accounts);
    if (!set.ok) {
      return Response.json({ error: set.error }, { status: 400 });
    }
    const pinned = email?.trim().toLowerCase() || "";
    recordFromRequest(req, "google-account", slug, pinned ? `default ${pinned}` : "default cleared");
    return Response.json({
      ok: true,
      accounts,
      recreate: true,
      detail: pinned
        ? `default ${pinned} — recreate to apply`
        : "cleared USER_GOOGLE_EMAIL — recreate to apply",
    });
  }
  return Response.json({ error: "op must be remove or default" }, { status: 400 });
});
