import {
  SESSION_COOKIE,
  addOperator,
  changeOwnPassphrase,
  denyUnlessAdmin,
  getOperator,
  listOperators,
  operatorFromRequest,
  parseCraneSlugs,
  parseRole,
  readCookie,
  recordFromRequest,
  removeOperator,
  setOperatorAccess,
  updateOwnProfile,
  withDoor,
} from "@/lib/yard/door";
import type { OperatorChannels, OperatorRole } from "@/lib/yard/door";

export const GET = withDoor(async (req: Request) => {
  const you = operatorFromRequest(req);
  if (!you) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const self = getOperator(you.id);
  if (you.role !== "admin") {
    return Response.json({ operators: self ? [self] : [], you: self });
  }
  return Response.json({ operators: listOperators(), you: self });
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
    displayName?: string;
    email?: string;
    description?: string;
    role?: OperatorRole;
    crane?: string | null;
    cranes?: unknown;
    channels?: OperatorChannels;
  };
  if (body.op === "profile") {
    const result = updateOwnProfile(you.id, {
      name: body.name,
      displayName: body.displayName,
      email: body.email,
      description: body.description,
      channels: body.channels,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-profile", null, result.operator.name);
    return Response.json({ ok: true, operator: result.operator });
  }
  if (body.confirm !== true) {
    return Response.json({ error: "confirm required" }, { status: 400 });
  }
  if (body.op === "passphrase") {
    if (typeof body.current !== "string" || typeof body.next !== "string") {
      return Response.json({ error: "current and next passphrase required" }, { status: 400 });
    }
    const result = changeOwnPassphrase(you.id, body.current, body.next, readCookie(req, SESSION_COOKIE) ?? undefined);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "passphrase", null, you.name);
    return Response.json({ ok: true });
  }

  const admin = denyUnlessAdmin(req);
  if (admin) {
    return admin;
  }

  if (body.op === "add") {
    if (typeof body.name !== "string" || typeof body.passphrase !== "string") {
      return Response.json({ error: "name and passphrase required" }, { status: 400 });
    }
    const role = body.role !== undefined ? parseRole(body.role) : "admin";
    if (!role) {
      return Response.json({ error: "role must be admin, user, or readonly", status: 400 });
    }
    const slugs = parseCraneSlugs(body.cranes ?? body.crane);
    if (!slugs.ok) {
      return Response.json({ error: slugs.error }, { status: 400 });
    }
    const result = addOperator(body.name, body.passphrase, role, slugs.cranes);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-add", null, `${result.operator.name}:${result.operator.role}`);
    return Response.json({ ok: true, operator: result.operator }, { status: 201 });
  }
  if (body.op === "remove") {
    if (typeof body.id !== "string" || !body.id) {
      return Response.json({ error: "operator id required" }, { status: 400 });
    }
    const gone = getOperator(body.id);
    const result = removeOperator(you.id, body.id);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-remove", null, gone?.name ?? body.id);
    return Response.json({ ok: true });
  }
  if (body.op === "access") {
    if (typeof body.id !== "string" || !body.id) {
      return Response.json({ error: "operator id required" }, { status: 400 });
    }
    const role = parseRole(body.role);
    if (!role) {
      return Response.json({ error: "role must be admin, user, or readonly" }, { status: 400 });
    }
    const slugs = parseCraneSlugs(body.cranes ?? body.crane);
    if (!slugs.ok) {
      return Response.json({ error: slugs.error }, { status: 400 });
    }
    const result = setOperatorAccess(body.id, role, slugs.cranes);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    recordFromRequest(req, "operator-access", null, `${result.operator.name}:${result.operator.role}`);
    return Response.json({ ok: true, operator: result.operator });
  }
  return Response.json({ error: "op must be add|remove|passphrase|profile|access" }, { status: 400 });
});
