import { denyUnlessAdmin, inspectYardDb, withDoor } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  return Response.json(inspectYardDb());
});
