import { doorStatus } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return Response.json(doorStatus(req));
}
