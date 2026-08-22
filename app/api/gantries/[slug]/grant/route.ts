import { toolsFetch } from "@/lib/yard/auth";
import { loadCatalog } from "@/lib/yard/catalog";
import { grant, revoke } from "@/lib/yard/grant";

export async function GET() {
  return Response.json({ catalog: loadCatalog() });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = (await req.json()) as { name?: string; op?: "grant" | "revoke" | "fetch" };
  if (body.op === "fetch") {
    const result = await toolsFetch(slug);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  if (!body.name) {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  const result = body.op === "revoke" ? await revoke(slug, body.name) : await grant(slug, body.name);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
