export const SECRET_DOTS = "••••••••";

export type SecretRow = { set: boolean; secret: boolean };

export type SecretLook = {
  type: "password" | "text";
  placeholder: string;
  status: string;
  missing: boolean;
};

/** Empty secrets are called out. Set secrets (or a typed draft) show as dots. */
export function secretLook(row: SecretRow, draft = "", noun: "key" | "token" = "key"): SecretLook {
  if (!row.secret) {
    return { type: "text", placeholder: "", status: row.set ? "set" : "empty", missing: false };
  }
  if (draft.trim()) {
    return { type: "password", placeholder: "", status: row.set ? "set" : `needs a ${noun}`, missing: false };
  }
  if (row.set) {
    return { type: "password", placeholder: SECRET_DOTS, status: "set", missing: false };
  }
  return { type: "text", placeholder: `needs a ${noun}`, status: `needs a ${noun}`, missing: true };
}

export function secretNoun(key: string): "key" | "token" {
  return /TOKEN/i.test(key) ? "token" : "key";
}

export function secretBadge(row: SecretRow, plain = ""): { text: string; missing: boolean } {
  if (!row.secret) {
    return { text: plain.trim() || "—", missing: false };
  }
  if (row.set) {
    return { text: SECRET_DOTS, missing: false };
  }
  return { text: "needs a key", missing: true };
}
