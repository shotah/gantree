import { withDoor } from "@/lib/yard/door";
import { loadBoardSnapshot } from "@/lib/yard/host/boards";

export const GET = withDoor(async () => {
  try {
    return Response.json(loadBoardSnapshot());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});
