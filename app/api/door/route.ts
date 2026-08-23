import { doorStatus, withDevSessionCookie } from "@/lib/yard/door";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withDevSessionCookie(req, Response.json(doorStatus(req)));
}
