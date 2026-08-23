import { addOperator, changeOwnPassphrase, listOperators, operatorFromRequest, recordFromRequest, removeOperator, withDoor } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  return Response.json({ operators: listOperators(), you });
});

export const POST = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    op?: string;
    name?: string;
    passphrase?: string;
    id?: string;
    current?: string;
    next?: string;
    confirm?: boolean;
  };
  if (body.confirm !== true) {
    return Response.json({ error: "confirm required" }, { status: 400 });
  }
  if (body.op === "add") {
    const result = addOperator(String(body.name ?? ""), String(body.passphrase ?? ""));
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-add", null, result.operator.name);
    return Response.json({ ok: true, operator: result.operator }, { status: 201 });
  }
  if (body.op === "remove") {
    const result = removeOperator(you.id, String(body.id ?? ""));
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-remove", null, body.id);
    return Response.json({ ok: true });
  }
  if (body.op === "passphrase") {
    const result = changeOwnPassphrase(you.id, String(body.current ?? ""), String(body.next ?? ""));
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "passphrase", null, you.name);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "op must be add|remove|passphrase" }, { status: 400 });
});
