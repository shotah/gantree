import { canBuildCrane, canMutateCrane, denyUnlessCraneMutate, denyUnlessCraneRead, operatorFromRequest, recordFromRequest, withDoor } from "@/lib/yard/door";
import { destroyCrane } from "@/lib/yard/crane/destroy";
import { getGantry } from "@/lib/yard/crane/inventory";
import { coerceTagColors, parseTagColors, parseTags } from "@/lib/yard/crane/tags";
import { loadTomlTagColors, mergeTomlTagColors, setTomlGantryTags } from "@/lib/yard/host/files";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const gantry = await getGantry(slug);
  if (!gantry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const you = operatorFromRequest(req);
  return Response.json({
    ...gantry,
    canMutate: Boolean(you && canMutateCrane(you, slug)),
    canBuild: Boolean(you && canBuildCrane(you)),
    tagColors: coerceTagColors(loadTomlTagColors()),
  });
});

export const DELETE = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const body = (await req.json().catch(() => ({}))) as { removeFiles?: boolean };
  const result = await destroyCrane(slug, { removeFiles: body.removeFiles === true });
  if (result.ok) {
    recordFromRequest(req, "destroy", slug, result.detail);
  }
  const status = result.ok ? 200 : result.detail.startsWith("unknown gantry") ? 404 : 400;
  return Response.json(result, { status });
});

export const PATCH = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneMutate(req, slug);
  if (denied) {
    return denied;
  }
  const gantry = await getGantry(slug);
  if (!gantry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { tags?: unknown; tagColors?: unknown };
  const hasTags = Object.prototype.hasOwnProperty.call(body, "tags");
  const hasColors = Object.prototype.hasOwnProperty.call(body, "tagColors");
  if (!hasTags && !hasColors) {
    return Response.json({ error: "tags or tagColors required" }, { status: 400 });
  }
  let tags = gantry.tags;
  if (hasTags) {
    const parsed = parseTags(body.tags);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    if (!setTomlGantryTags(slug, parsed.tags)) {
      return Response.json({ error: "tags live in gantree.toml — this crane is not in inventory" }, { status: 400 });
    }
    tags = parsed.tags;
  }
  if (hasColors) {
    const parsed = parseTagColors(body.tagColors);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    if (!mergeTomlTagColors(parsed.colors)) {
      return Response.json({ error: "tag colors live in gantree.toml" }, { status: 400 });
    }
  }
  recordFromRequest(req, "tags", slug, tags.join(", ") || "(none)");
  const next = await getGantry(slug);
  return Response.json({
    ok: true,
    tags: next?.tags ?? tags,
    tagColors: coerceTagColors(loadTomlTagColors()),
  });
});
