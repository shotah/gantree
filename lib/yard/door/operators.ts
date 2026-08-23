import { accessForRole, serializeCranes } from "./access";
import {
  parseChannelsPatch,
  parseRole,
  serializeOperatorChannels,
  validateDescription,
  validateDisplayName,
  validateEmail,
  type OperatorRole,
} from "./channels";
import { dummyHash, hashPassphrase, NAME_RE, validateCredentials, validatePassphrase, verifyPassphrase } from "./pass";
import { removeOperatorAvatar } from "./profile";
import { createSession, tokenHash } from "./session";
import { operatorRow, type DoorFail, type Operator, type OperatorDb, type OperatorProfilePatch, type OperatorRow } from "./shape";
import { yardDb } from "./store";

export function operatorCount(): number {
  const row = yardDb().prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

function adminCount(): number {
  const row = yardDb().prepare("SELECT COUNT(*) AS n FROM operator WHERE role = 'admin'").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function setupOperator(name: string, passphrase: string): { ok: true; operator: Operator; token: string } | { ok: false; error: string; status: number } {
  if (typeof name !== "string" || typeof passphrase !== "string") {
    return { ok: false, error: "name and passphrase required", status: 400 };
  }
  const fields = validateCredentials(name, passphrase);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  const db = yardDb();
  db.exec("BEGIN");
  try {
    const n = Number((db.prepare("SELECT COUNT(*) AS n FROM operator").get() as { n: number } | undefined)?.n ?? 0);
    if (n > 0) {
      db.exec("ROLLBACK");
      return { ok: false, error: "already set up", status: 409 };
    }
    const operator: Operator = {
      id: crypto.randomUUID(),
      name: name.trim(),
      displayName: name.trim(),
      role: "admin",
      cranes: [],
      avatarRev: null,
    };
    const { salt, hash } = hashPassphrase(passphrase);
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO operator (id, name, pass_salt, pass_hash, created_at, display_name, email, description, role, crane_slug, channels) VALUES (?, ?, ?, ?, ?, ?, '', '', 'admin', NULL, '{}')",
    ).run(operator.id, operator.name, salt, hash, now, operator.displayName);
    const token = createSession(operator.id, now);
    db.exec("COMMIT");
    return { ok: true, operator, token };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function listOperators(): OperatorRow[] {
  const rows = yardDb()
    .prepare(
      "SELECT id, name, display_name, email, description, role, crane_slug, channels, created_at FROM operator ORDER BY created_at, name",
    )
    .all() as OperatorDb[];
  return rows.map(operatorRow);
}

export function getOperator(id: string): OperatorRow | null {
  const row = yardDb()
    .prepare(
      "SELECT id, name, display_name, email, description, role, crane_slug, channels, created_at FROM operator WHERE id = ?",
    )
    .get(id) as OperatorDb | undefined;
  return row ? operatorRow(row) : null;
}

export function addOperator(
  name: string,
  passphrase: string,
  role: OperatorRole = "admin",
  cranes: unknown = null,
): { ok: true; operator: OperatorRow } | DoorFail {
  if (typeof name !== "string" || typeof passphrase !== "string") {
    return { ok: false, error: "name and passphrase required", status: 400 };
  }
  const fields = validateCredentials(name, passphrase);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  const parsed = parseRole(role);
  if (!parsed) {
    return { ok: false, error: "role must be admin, user, or readonly", status: 400 };
  }
  const access = accessForRole(parsed, cranes);
  if (!access.ok) {
    return { ok: false, error: access.error, status: 400 };
  }
  const db = yardDb();
  const exists = db
    .prepare("SELECT id FROM operator WHERE name = ? COLLATE NOCASE")
    .get(name.trim()) as { id: string } | undefined;
  if (exists) {
    return { ok: false, error: "name already taken", status: 409 };
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { salt, hash } = hashPassphrase(passphrase);
  db.prepare(
    "INSERT INTO operator (id, name, pass_salt, pass_hash, created_at, display_name, email, description, role, crane_slug, channels) VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, '{}')",
  ).run(id, name.trim(), salt, hash, createdAt, name.trim(), access.role, serializeCranes(access.cranes));
  const operator = getOperator(id);
  if (!operator) {
    return { ok: false, error: "operator write vanished", status: 500 };
  }
  return { ok: true, operator };
}

export function removeOperator(_actorId: string, targetId: string): { ok: true } | DoorFail {
  const n = operatorCount();
  if (n <= 1) {
    return { ok: false, error: "cannot delete the last operator", status: 400 };
  }
  const target = getOperator(targetId);
  if (!target) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  if (target.role === "admin" && adminCount() <= 1) {
    return { ok: false, error: "cannot delete the last admin", status: 400 };
  }
  yardDb().prepare("DELETE FROM operator WHERE id = ?").run(targetId);
  removeOperatorAvatar(targetId);
  return { ok: true };
}

export function setOperatorAccess(
  targetId: string,
  role: OperatorRole,
  cranes: unknown = null,
): { ok: true; operator: OperatorRow } | DoorFail {
  const parsed = parseRole(role);
  if (!parsed) {
    return { ok: false, error: "role must be admin, user, or readonly", status: 400 };
  }
  const access = accessForRole(parsed, cranes);
  if (!access.ok) {
    return { ok: false, error: access.error, status: 400 };
  }
  const target = getOperator(targetId);
  if (!target) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  if (target.role === "admin" && access.role !== "admin" && adminCount() <= 1) {
    return { ok: false, error: "cannot demote the last admin", status: 400 };
  }
  yardDb().prepare("UPDATE operator SET role = ?, crane_slug = ? WHERE id = ?").run(access.role, serializeCranes(access.cranes), targetId);
  const next = getOperator(targetId);
  if (!next) {
    return { ok: false, error: "operator write vanished", status: 500 };
  }
  return { ok: true, operator: next };
}

/** Drop a destroyed slug from every user/readonly assignment. Empty lists are allowed. */
export function unassignCrane(slug: string): number {
  let n = 0;
  for (const op of listOperators()) {
    if (op.role === "admin" || !op.cranes.includes(slug)) {
      continue;
    }
    const next = op.cranes.filter((c) => c !== slug);
    yardDb().prepare("UPDATE operator SET crane_slug = ? WHERE id = ?").run(serializeCranes(next), op.id);
    n += 1;
  }
  return n;
}

function writePassphrase(
  operatorId: string,
  name: string,
  next: string,
  keepToken?: string,
): { ok: true } | DoorFail {
  const fields = validatePassphrase(next, name);
  if (fields) {
    return { ok: false, error: fields, status: 400 };
  }
  const { salt, hash } = hashPassphrase(next);
  const db = yardDb();
  db.prepare("UPDATE operator SET pass_salt = ?, pass_hash = ? WHERE id = ?").run(salt, hash, operatorId);
  if (keepToken) {
    db.prepare("DELETE FROM operator_session WHERE operator_id = ? AND token_hash != ?").run(operatorId, tokenHash(keepToken));
  } else {
    db.prepare("DELETE FROM operator_session WHERE operator_id = ?").run(operatorId);
  }
  return { ok: true };
}

export function changeOwnPassphrase(
  operatorId: string,
  current: string,
  next: string,
  keepToken?: string,
): { ok: true } | DoorFail {
  if (typeof current !== "string" || typeof next !== "string") {
    return { ok: false, error: "current and next passphrase required", status: 400 };
  }
  const row = yardDb()
    .prepare("SELECT name, pass_salt, pass_hash FROM operator WHERE id = ?")
    .get(operatorId) as { name: string; pass_salt: Uint8Array; pass_hash: Uint8Array } | undefined;
  if (!row) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  if (!verifyPassphrase(current, row.pass_salt, row.pass_hash)) {
    dummyHash(next);
    return { ok: false, error: "current passphrase is wrong", status: 401 };
  }
  if (current === next) {
    dummyHash(next);
    return { ok: false, error: "choose a different passphrase", status: 400 };
  }
  return writePassphrase(operatorId, row.name, next, keepToken);
}

/** Admin set. Drops every session for that operator. */
export function resetOperatorPassphrase(operatorId: string, next: string): { ok: true } | DoorFail {
  if (typeof next !== "string") {
    return { ok: false, error: "next passphrase required", status: 400 };
  }
  const row = yardDb()
    .prepare("SELECT name FROM operator WHERE id = ?")
    .get(operatorId) as { name: string } | undefined;
  if (!row) {
    return { ok: false, error: "operator not found", status: 404 };
  }
  return writePassphrase(operatorId, row.name, next);
}

export function updateOwnProfile(
  operatorId: string,
  patch: OperatorProfilePatch,
): { ok: true; operator: OperatorRow } | DoorFail {
  const db = yardDb();
  const row = db
    .prepare(
      "SELECT id, name, display_name, email, description, role, crane_slug, channels, created_at FROM operator WHERE id = ?",
    )
    .get(operatorId) as OperatorDb | undefined;
  if (!row) {
    return { ok: false, error: "operator not found", status: 404 };
  }

  let name = row.name;
  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") {
      return { ok: false, error: "name must be a string", status: 400 };
    }
    const next = patch.name.trim();
    if (!NAME_RE.test(next)) {
      return { ok: false, error: "name must be 2–32 letters, digits, dot, underscore, or hyphen", status: 400 };
    }
    const clash = db
      .prepare("SELECT id FROM operator WHERE name = ? COLLATE NOCASE AND id != ?")
      .get(next, operatorId) as { id: string } | undefined;
    if (clash) {
      return { ok: false, error: "name already taken", status: 409 };
    }
    name = next;
  }

  let displayName = row.display_name ?? "";
  if (patch.displayName !== undefined) {
    const err = validateDisplayName(patch.displayName);
    if (err) {
      return { ok: false, error: err, status: 400 };
    }
    displayName = patch.displayName.trim();
  }

  let email = row.email ?? "";
  if (patch.email !== undefined) {
    const err = validateEmail(patch.email);
    if (err) {
      return { ok: false, error: err, status: 400 };
    }
    email = patch.email.trim();
  }

  let description = row.description ?? "";
  if (patch.description !== undefined) {
    const err = validateDescription(patch.description);
    if (err) {
      return { ok: false, error: err, status: 400 };
    }
    description = patch.description.trim();
  }

  let channelsJson = row.channels ?? "{}";
  if (patch.channels !== undefined) {
    const parsed = parseChannelsPatch(patch.channels);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, status: 400 };
    }
    channelsJson = serializeOperatorChannels(parsed.channels);
  }

  db.prepare(
    "UPDATE operator SET name = ?, display_name = ?, email = ?, description = ?, channels = ? WHERE id = ?",
  ).run(name, displayName, email, description, channelsJson, operatorId);
  const next = getOperator(operatorId);
  if (!next) {
    return { ok: false, error: "operator write vanished", status: 500 };
  }
  return { ok: true, operator: next };
}
