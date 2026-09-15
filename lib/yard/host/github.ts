import { yardDb } from "../door/store";
import { githubApiToken } from "../tools/packages";

export function loadYardGithubToken(): string {
  const row = yardDb().prepare("SELECT github_token FROM yard_settings WHERE id = 1").get() as
    | { github_token?: string }
    | undefined;
  return (row?.github_token ?? "").trim();
}

/** Blank keeps the stored token. Returns whether a token is now stored. */
export function saveYardGithubToken(raw: string): boolean {
  const token = raw.trim();
  if (!token) {
    return Boolean(loadYardGithubToken());
  }
  yardDb()
    .prepare(
      `INSERT INTO yard_settings (id, github_token, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET github_token = excluded.github_token, updated_at = excluded.updated_at`,
    )
    .run(token, new Date().toISOString());
  return true;
}

export function githubTokenIsSet(hostEnv: Record<string, string | undefined> = process.env): boolean {
  return Boolean(resolveGithubApiToken({}, hostEnv));
}

export function resolveGithubApiToken(
  craneEnv: Record<string, string> = {},
  hostEnv: Record<string, string | undefined> = process.env,
): string {
  return githubApiToken(craneEnv, hostEnv, loadYardGithubToken());
}
