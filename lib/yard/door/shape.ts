import { parseStoredCranes, parseStoredRole } from "./access";
import { parseOperatorChannels, type OperatorChannels, type OperatorRole } from "./channels";
import { operatorAvatarRev } from "./profile";

export type Operator = {
  id: string;
  name: string;
  displayName: string;
  role: OperatorRole;
  cranes: string[];
  avatarRev: number | null;
};

export type OperatorRow = Operator & {
  email: string;
  description: string;
  channels: OperatorChannels;
  createdAt: string;
};

export type OperatorProfilePatch = {
  name?: string;
  displayName?: string;
  email?: string;
  description?: string;
  role?: OperatorRole;
  cranes?: string[];
  channels?: OperatorChannels;
};

export type DoorStatus = {
  ready: boolean;
  operator: Operator | null;
  bindOpen: boolean;
  /** Same gate as auto-login: `GANTREE_DEV` on loopback. */
  dev: boolean;
};

export type DoorFail = { ok: false; error: string; status: number };

export type OperatorDb = {
  id: string;
  name: string;
  display_name: string | null;
  email: string | null;
  description: string | null;
  role: string | null;
  crane_slug: string | null;
  channels: string | null;
  created_at: string;
};

export function publicOperator(row: {
  id: string;
  name: string;
  display_name: string | null;
  role: string | null;
  crane_slug?: string | null;
}): Operator {
  const role = parseStoredRole(row.role);
  return {
    id: row.id,
    name: row.name,
    displayName: (row.display_name ?? "").trim() || row.name,
    role,
    cranes: role === "admin" ? [] : parseStoredCranes(row.crane_slug),
    avatarRev: operatorAvatarRev(row.id),
  };
}

export function operatorRow(row: OperatorDb): OperatorRow {
  return {
    ...publicOperator(row),
    email: row.email ?? "",
    description: row.description ?? "",
    channels: parseOperatorChannels(row.channels),
    createdAt: row.created_at,
  };
}
