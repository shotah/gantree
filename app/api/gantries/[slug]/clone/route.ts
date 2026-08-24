import { denyUnlessAdmin, recordFromRequest, withDoor } from "@/lib/yard/door";
import { cloneCrane } from "@/lib/yard/crane/clone";

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  const { slug: source } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    settings?: boolean;
    persona?: boolean;
    database?: boolean;
  };
  const result = await cloneCrane(source, {
    slug: typeof body.slug === "string" ? body.slug : "",
    settings: body.settings === true,
    persona: body.persona === true,
    database: body.database === true,
  });
  if (result.ok) {
    recordFromRequest(req, "clone", result.slug, result.detail);
  }
  const status = result.ok ? 201 : result.detail.startsWith("unknown gantry") ? 404 : 400;
  return Response.json(result, { status });
});
