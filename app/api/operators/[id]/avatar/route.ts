import { readFileSync } from "node:fs";
import {
  getOperator,
  operatorFromRequest,
  readOperatorAvatar,
  recordFromRequest,
  saveOperatorAvatar,
  withDoor,
} from "@/lib/yard/door";

export const GET = withDoor(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!getOperator(id)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const hit = readOperatorAvatar(id);
  if (!hit) {
    return new Response(null, { status: 404 });
  }
  const buf = readFileSync(hit.path);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": hit.type,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const POST = withDoor(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (you.id !== id) {
    return Response.json({ error: "can only change your own photo" }, { status: 403 });
  }
  if (!getOperator(id)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const row = form.get("file");
    file = row instanceof Blob ? row : null;
  } catch {
    return Response.json({ error: "multipart file required" }, { status: 400 });
  }
  if (!file) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = saveOperatorAvatar(id, bytes);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  recordFromRequest(req, "operator-avatar", null, you.name);
  return Response.json({ ok: true, rev: result.rev });
});
