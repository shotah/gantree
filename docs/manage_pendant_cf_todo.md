# Manage pendant Cloudflare from the yard

Today Worker secrets are a second dashboard: `gantry-pendant` `.env` +
`npm run secrets:push` / wrangler. Per-crane bearers and Google OIDC
do not belong in that checkout. They belong on **this** board.

Not chat. Gantree still never sits in a turn. This is Worker **config**
only: OAuth + one bearer per crane.

Pendant deploy of *code* stays CI in gantry-pendant
(`repos/gantry-pendant/docs/deployment.md`). After the Worker exists,
the yard owns the secrets.

Walk is done when: Settings has Cloudflare + Google. Build Kit as
pendant. No pendant checkout, no Cloudflare dashboard, no
`secrets:push`. Recreate. Phone Google works. Kit dials `/ws/kit`.

Contract: [access.md](access.md). Mouth paste today:
`repos/gantry-pendant/docs/setup.md`. Yard leftover walks:
[todo.md](todo.md).

---

## Shape

No wrangler on the Mini. The yard process `fetch`es the Cloudflare
Workers Secrets API (`PUT …/workers/scripts/{name}/secrets`). Admin
Settings holds the API token. Cranes never get that token.
**ai-gantry does not push.** It only reads `PENDANT_BEARER` at boot.

```text
Settings (once)     →  Worker secrets: Google, SESSION_SECRET
Build / Pendant     →  mint bearer, write crane .env, merge CRANE_BEARERS
                       then recreate
ai-gantry           →  dials wss://…/ws/<slug> with that bearer
```

---

## Settings — once (admin)

`/settings` already exists (operators). Add a **Pendant / Cloudflare**
fold, admin only. Store token + account off `gantree.toml` (that file
is inventory, no secrets). Yard sqlite or a gitignored secrets file.

- [x] Cloudflare: `CLOUDFLARE_API_TOKEN` — Account **Workers Scripts
      Edit** (PUT secrets). GitHub CI also needs **Workers KV Storage
      Edit** + **Account Settings Read**. Not the Global API Key.
      [Create token](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=%2A&zoneId=all&name=gantry-pendant)
      (pre-fills those three). Same token can be GitHub + Settings.
      [access.md](access.md#cloudflare-api-token). Also
      `CLOUDFLARE_ACCOUNT_ID`, Worker name (default `gantry-pendant`)
- [x] OAuth variables pushed to the Worker:
      `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`
- [x] Mint `SESSION_SECRET` if empty (same job as pendant
      `npm run secret`)
- [x] Show the redirect to paste in GCP (Gantree does **not** create
      the Google client). GCP → **APIs & Services → Credentials →
      OAuth client ID:**

      | Field | Value |
      | --- | --- |
      | Application type | **Web application** |
      | Authorized JavaScript origins | `https://<pendant-origin>` |
      | Authorized redirect URIs | `https://<pendant-origin>/api/auth/callback/google` |

      Consent: **External** (or Internal if Workspace-only). Scopes
      `openid`, `email`, `profile` only — no Gmail/Drive. External +
      Testing: add yourself as a test user. Not Desktop, not
      `oauth-catch`, not google-mcp, not `localhost:4100`.
      [access.md](access.md#google-oauth-client-gcp)
- [x] Optional: pendant origin / account subdomain so the wizard can
      fill `PENDANT_MAILBOX_URL=wss://…/ws/<slug>`
- [x] Optional yard-wide `ALLOWED_SUBS` (break-glass). Not the human
      list.
- [x] Save = API put. Never log values. Confirm-scary rotate.
- [x] Compose: outbound HTTPS to Cloudflare on the console
      container. No wrangler binary. Distroless cranes stay as they are.

GCP Web application client is still a Google Console click. Settings
only holds and **pushes** the client id/secret.

---

## Per crane — mint and push

Build wizard and Kit’s Pendant fold. No pendant `.env`.

- [x] On channel **pendant**: mint a bearer (uuid / base64url). Write
      crane `.env`: `CHANNEL=pendant`, `PENDANT_MAILBOX_URL`,
      `PENDANT_BEARER`, `PENDANT_ALLOWED_USERS`
- [x] Same request: merge `slug:bearer` into Worker `CRANE_BEARERS`
      (do not drop other slugs)
- [x] Nag **recreate** (boot reads `.env`; restart keeps a ghost)
- [x] Rotate: new token, put Worker, write `.env`, recreate. Instant
      kill if the crane is down
- [x] Destroy/retire: drop that slug from `CRANE_BEARERS` so the
      token cannot rejoin
- [x] Empty Worker `CRANE_BEARERS` on first pendant crane is fine —
      Settings OAuth + this mint are the first put
- [x] Failure (no CF token in Settings): refuse the build with a
      pointer to Settings, do not write a crane that cannot dial

ai-gantry: no Cloudflare code. Zero inbound stays.

---

## Walk

- [ ] Settings: CF token + account + Worker name. Paste Google client.
      Save. Worker is no longer `503 config`
- [ ] Build Kit, channel pendant, tick Ada’s email. No bearer field to
      paste. Recreate
- [ ] Ada signs in on the pendant origin, sees Kit, talks
- [ ] Second crane (tryout): second minted bearer, Kit still answers
- [ ] Rotate Kit’s bearer from the panel. Old socket dies. Recreate.
      Phone still works
- [ ] Stranger with three READMEs never opens the Cloudflare dashboard
      and never clones gantry-pendant for secrets

---

## Not this

- Chat through Gantree
- Cloudflare Access on the mailbox
- CF API token on a crane or in ai-gantry
- Creating the GCP OAuth client from the yard
- `MAILBOX_SECRET` / `PENDANT_DEV` on workers.dev
- Replacing gantry-pendant CI (code deploy stays there)
- A central user DB the Worker reads for humans — crane `.env` is
  still the allowlist
- Wrangler / `secrets:push` on the Mini — the Workers Secrets HTTP API
  is enough

This file **replaces** the old “Gantree writing Worker secrets” ban
for **this** config path only.
