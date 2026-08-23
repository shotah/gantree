export type EnvRow = { set: boolean; secret: boolean; value: string };

export const SECRET_NAME = /TOKEN|KEY|SECRET|PASSWORD/i;

export function envRow(k: string, env?: Record<string, EnvRow>): EnvRow {
  return env?.[k] ?? { set: false, secret: SECRET_NAME.test(k), value: "" };
}

export function fieldValue(k: string, row: EnvRow, draft: Record<string, string>): string {
  if (k in draft) {
    return draft[k] ?? "";
  }
  return row.secret ? "" : row.value;
}

export function looksLikeUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}
