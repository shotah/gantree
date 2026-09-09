# Access — who may operate, who may talk

Three repos, three doors, one household. This page is how a **person**
lines up across them: the yard login here, the Google sign-in on the
pendant, and the allowlist the crane actually obeys.

The crane’s `.env` is the one human allowlist. Gantree writes it. The
crane reads it at boot and, on dial, publishes an `allow` frame. The
Worker enforces that room list. Yank a person = edit `.env` + recreate,
the same motion as Telegram.

Door details: [security.md](security.md). People on the yard:
[operators.md](operators.md). Pendant side (nested checkout, dev only):
`repos/gantry-pendant/docs/setup.md`, `security.md`, `edgecases.md`.
Harness contract: `repos/ai-gantry/docs/gantree-contract.md`. Outstanding
walks: [todo.md](https://github.com/shotah/gantree/blob/main/docs/todo.md).

---

## Why three doors

The three were built independent on purpose. Each has its own idea of
a person, and none of them reads another’s database.

| Piece | Job | Knows a person as | Door |
| --- | --- | --- | --- |
| **gantree** (yard) | Docker + files. Writes crane `.env`, `mcp.toml`, persona. | operator row: name, passphrase hash, role, cranes, email, chat ids, Google `sub` | `/login` passphrase |
| **ai-gantry** (crane) | The agent. Reads `.env` at boot. Never learns the yard exists. | allowlist in env: Telegram id, Discord id, Slack id, or Google `sub` / email | `*_ALLOWED_USERS`, fail closed |
| **gantry-pendant** (mouth) | Cloudflare Worker + Durable Object room per crane. Phone and crane both dial in. | Google `sub` from OIDC; crane by bearer | room list from the crane’s `allow` frame; optional `ALLOWED_SUBS` break-glass |

Two different populations live here, and they only overlap:

- **Operators** — people who may *touch* a crane (grant, Secrets,
  recreate). They have a yard passphrase. Chat is not theirs by right.
- **Humans on the mouth** — people the *agent will answer*. They need a
  Google account on a list. They never need a yard login.

Bob can operate Kit and never message her. Ada can message Kit from
her phone and never see the board. That is fine. The mistake is
looking for one login that does both.

```text
                gantree (yard)          passphrase door
                 operator row
                 email · google sub · chat ids
                      |
                      | writes .env       TELEGRAM_ALLOWED_USERS
                      |                   PENDANT_ALLOWED_USERS
                      v
phone -- Google --> Worker room <-- crane (bearer)   CHANNEL=pendant
        room list from "allow"     PENDANT_ALLOWED_USERS (.env)
                      |
                      | frame.user_id = sub, frame.email
                      v
                 ai-gantry Completer
```

Two checks of **one** list, written from **one** place. Static
`ALLOWED_SUBS` on the Worker is optional yard-wide extra (the Cloudflare
account owner’s break-glass), not a second human roster.

---

## The principle

**The crane’s `.env` is the one human allowlist. Everything else reads
it.**

- Gantree writes it (build wizard, Secrets, Telegram push, pendant
  panel).
- The crane reads it at boot and fails closed.
- The crane dials the Worker and publishes state on connect — including
  who may talk.

The Worker does not keep a parallel human list as the source of truth.
Yank a person = edit `.env` + recreate, and the Worker follows on the
next dial.

Nothing here gives the harness a port, a yard name, or a settings API.
The frame goes *out* on the socket it already holds.

---

## Shared contract

Every repo codes to this section. Change it here first.

### Allowlist entry grammar (`PENDANT_ALLOWED_USERS`)

Comma or whitespace separated. Three forms:

| Entry | Parse |
| --- | --- |
| `118212345678901234567` | `sub` = digits |
| `118212345678901234567:ada@example.com` | split at the **first** `:`; `sub` left, email right (lowercased) |
| `ada@example.com` | no `:` and contains `@` → email only, lowercased |

Normalize: trim, drop empties, dedupe by `sub` then by email. Anything
that is neither digits nor an email is a config error at boot (crane)
and a dropped entry with a warning (Worker). Empty after normalization
fails boot.

### Frames (crane ↔ room)

Crane → room, right after `cmds`, and again on every reconnect:

```json
{ "kind": "allow", "users": [
  { "sub": "118212345678901234567", "email": "ada@example.com" },
  { "email": "bob@example.com" }
] }
```

Room → crane, `email` beside `user_id`:

```json
{ "kind": "msg", "user_id": "118212345678901234567",
  "email": "ada@example.com", "text": "…", "context": { } }
```

`user_id` is always the Google `sub`. `email` is Google’s verified
claim, lowercased, or omitted. Crane admits when `user_id` **or**
`email` is on its list. Session id: `pendant:<slug>:<sub>`.

### Worker admission

| Check | Where | On miss |
| --- | --- | --- |
| Google ID token (`iss`, `aud`, `exp`, nonce, signature) | callback | `unauthorized`, no cookie |
| Session cookie (JWE, hard 7d) | handshake, every frame | `4401` |
| `sub` ∈ room list **or** (`email_verified` ∧ `email` ∈ room list) **or** `sub` ∈ `ALLOWED_SUBS` | handshake, every frame | `4401` |
| Crane bearer bound to slug | handshake | `unauthorized` |

Room list = last `allow` frame stored on that slug’s Durable Object.
New `allow` → re-check every phone socket, close the ones no longer on
it.

### `/api/auth/me`

```json
{ "sub": "118212345678901234567", "email": "ada@example.com",
  "cranes": ["kit", "ada"] }
```

`cranes` comes from the directory (KV: `sub:<sub>` and `email:<email>`
→ slugs), written by each DO when it stores an `allow` frame. Empty
list is a valid answer for a signed-in stranger. The only identity a
stranger sees is their own.

### Gantree operator row

`channels.google` is digits (`/^\d{10,32}$/`), same caps as Telegram.
`@` is rejected: needs the Google `sub`, not the email. Email already
exists on the row. Push writes `sub:email` when `google` is set,
`email` when it is not.

---

## Key: `sub`, email, or both

Google’s stable id is `sub` (a ~21-digit string). Humans and Gantree
know **emails**. Pick both, with a rule:

| Entry | Meaning |
| --- | --- |
| `118212345678901234567` | `sub`. The key. Survives an email change. |
| `118212345678901234567:ada@example.com` | `sub` with a label. |
| `ada@example.com` | **Alias.** Matches a Google ID token whose `email` is this (case-folded) **and** `email_verified` is true. |

Rules:

- The Worker admits a phone when `sub` is on the room list, **or** the
  verified email is. Either way it stamps `user_id = sub` on every frame
  and adds `email` beside it.
- The crane admits a frame when `user_id` **or** `email` is on its list.
  Session id stays `pendant:<slug>:<sub>` so memory does not fork if
  the email changes later.
- Exact match on Google’s `email` claim, lowercased. No Gmail-dot or
  `+tag` normalization. A Workspace `hd` gate is a later knob.
- Gantree writes `sub:email` when it knows the `sub`, `email` when it
  does not. Once the person has talked, the harness logs `user_id` in
  `turn perf`; the yard maps that to a display name for spend and
  offers to store an unseen id on the matching operator. **No one
  decodes a JWT.**

Email-as-alias is what makes “the email on the operator is the
allowlist” true. The phone can also show the `sub` after sign-in.

---

## What each piece does

| Question | Answer |
| --- | --- |
| Does the yard email reach the crane? | **Yes, as an allowlist entry.** Kit’s pendant panel writes `PENDANT_ALLOWED_USERS` as `email` until the `sub` is learned, then `sub:email`. Inject user still copies email into `PERSONA.md` *About you* as text, not a key. |
| Does the yard email reach the Worker? | No. The Worker never talks to Gantree and ignores the yard cookie. The crane’s `allow` frame carries the list. |
| Does the crane allowlist reach the Worker? | Yes, via the `allow` frame on dial. |
| Who decides whether Ada may sign in? | The room list from the crane. Optional `ALLOWED_SUBS` is break-glass, not the roster. |
| Who decides whether Kit answers Ada? | `PENDANT_ALLOWED_USERS` in Kit’s `.env`, read at boot. Recreate, not restart. |
| How does Ada learn her `sub`? | Spend and the pendant panel show slog `user_id` and offer to store it on her profile. The pendant `/me` shows her own id. No JWT decode. |
| Can Gantree push a person onto a pendant list? | **Yes.** Twin of Telegram: confirm-scary push writes `PENDANT_ALLOWED_USERS`, nags recreate, audits `pendant.allowlist`. |
| Is there a Google id on the operator row? | **Yes.** `channels.google` is digits. Email already existed. |

Gantree still never chats, and never sends the yard cookie anywhere.
`CRANE_BEARERS` is a Cloudflare secret the **yard** mints and pushes
(Settings token, admin only). One bearer per crane. The bearer already
lets its holder run the whole room, so letting it also name who may
enter that room adds no reach.

---

## Should the yard log in with Google?

Asked directly: no, not as the door. Reasons that hold on a Mini:

| Concern | What happens |
| --- | --- |
| Redirect URI | Google Web clients accept `http://127.0.0.1:3000/...` and public HTTPS. They **reject** private LAN IPs (`http://192.168.x.x`). Compose on LAN `:80` would have no working callback unless you front it with Tailscale HTTPS or a Tunnel. |
| Internet down | Kit is down too, but you still want the board to say so and to tail her logs. A door that needs `accounts.google.com` locks you out of your own box exactly when you need it. |
| First boot | `/setup` needs a GCP client before the first operator exists. Today it is one passphrase and you are in. |
| Still a list | Google proves *who*. It does not say *whether*. You still keep an allowlist; the passphrase door is that list plus a secret. |

Keep the passphrase as the yard door. The yard is the **registry**
(email, learned `sub`, chat ids, role, cranes). The Worker is the
**Google consumer**. The crane is the **policy**.

Optional later, not a blocker: **Link Google** on `/profile` — an OIDC
hop with `openid email` whose only output is `sub` + verified email
written onto your own row. Not a session, not a login. Works on
loopback and HTTPS origins only. Skip it while the pendant can show the
`sub` after sign-in.

---

## End to end

### Once (before any person)

1. Deploy the Worker (code: gantry-pendant CI).
2. GCP **Web application** client — [Google OAuth client](#google-oauth-client-gcp).
   Yard Settings → Pendant pushes `GOOGLE_*`, `SESSION_SECRET`, and
   per-crane bearers — [manage_pendant_cf_todo.md](manage_pendant_cf_todo.md).
   Code deploy stays gantry-pendant CI.
3. Per crane: Build channel pendant (or Rotate bearer on the panel).
   The yard mints a bearer, merges `CRANE_BEARERS`, writes
   `PENDANT_BEARER`. Recreate.
4. Yard: `/setup`, one admin. Passphrase. As today.

### Cloudflare API token

Gantree Settings only **PUT**s Worker secrets. That is Account →
**Workers Scripts Edit**. GitHub CI (code deploy in gantry-pendant)
also needs **Workers KV Storage Edit** and **Account Settings Read**.
One token with all three is fine. Not the Global API Key.

**Quick create** (pre-fills the three; still click Create Token):

[Create gantry-pendant token](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=%2A&zoneId=all&name=gantry-pendant)

Yard-only (no CI):
[Workers Scripts Edit](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=%2A&zoneId=all&name=gantry-pendant%20secrets).

Or Profile → API Tokens → **Edit Cloudflare Workers**. Same token can
sit in GitHub and Settings. Table:
[gantry-pendant deployment](../repos/gantry-pendant/docs/deployment.md#cloudflare-api-token).

### Google OAuth client (GCP)

Gantree does **not** create this. **APIs & Services → Credentials →
Create credentials → OAuth client ID.** Not Desktop, not the
google-mcp client.

| Field | Value |
| --- | --- |
| Application type | **Web application** |
| Authorized JavaScript origins | `https://<pendant-origin>` |
| Authorized redirect URIs | `https://<pendant-origin>/api/auth/callback/google` |

Consent screen (once per project): **External** (or Internal if
Workspace-only). Scopes `openid`, `email`, `profile` only — no
Gmail/Drive. External + Testing: add yourself as a test user. Not
`oauth-catch`, not `localhost:4100`.

Paste **Client ID** and **Client secret** into Settings → Pendant.
The fold shows the redirect after origin is saved.

### Add a human to Kit

1. Admin (or `user` on Kit) opens Kit → pendant panel. Ticks the
   operator, or types an email for someone who is not an operator at
   all. Confirm-scary. Gantree writes `PENDANT_ALLOWED_USERS`.
2. Recreate Kit. Boot reads the list; dial publishes `allow`; the DO
   stores it and indexes the email.
3. Ada opens the pendant, Sign in with Google. `/api/auth/me` returns
   `cranes: ["kit"]`. She taps Kit. First frame carries `user_id` +
   `email`; Kit matches the email and answers.
4. Kit’s `turn perf` logs `user_id`. Spend on the yard shows a raw
   `1182…` and suggests storing it on ada’s profile. Admin accepts;
   next push writes `sub:email`.

No Cloudflare dashboard after Settings + first mint. No JWT decoding.
One recreate.

### Yank

1. Untick / remove from Kit’s list. Recreate. Kit’s dial publishes the
   shorter `allow`; the DO closes Ada’s socket `4401`.
2. Emergency (crane down, cannot recreate now): rotate Kit’s bearer in
   `CRANE_BEARERS`. The room refuses the old crane; the phone has no one
   to talk to. Fix `.env`, paste the new bearer, recreate.
3. Stolen phone: OS lock, Google → sign out other sessions, then 1.

### Email change

The `sub` did not change. If the list has `sub:email`, nothing to do
but relabel. If it has `email` only, the old address stops matching —
update the operator email and push again. This is why the yard should
learn the `sub` when it can.

### Operator leaves the yard

Settings → remove. Their sessions cascade. **Their `sub` is still on
any crane list you pushed it to** — the row is gone, the `.env` is a
file. The confirm-scary modal nags: “ada is on Kit’s pendant list;
untick and recreate.” Isolation stays the feature: no silent
cross-crane edit.

---

## Threats that move

| Change | Risk | Why it is acceptable |
| --- | --- | --- |
| Crane names its own room’s humans | Bearer holder can admit anyone to **that** room | Bearer already impersonates the crane and reads the queue. Same blast radius. Kit’s bearer still cannot touch Ada’s slug. |
| Session for any verified Google account | Strangers hold a cookie | It opens no room. Rate-limit the callback; same `unauthorized` shape for every room miss; the only id shown is your own. |
| Email as alias | Someone else’s Google account with that email? | Google verifies `email` on its own accounts. Exact match, case-folded, `email_verified` required. Workspace `hd` optional. |
| Room list remembered while crane is down | Yank waits for a recreate | Same as `TELEGRAM_ALLOWED_USERS` today. Bearer rotation is the instant kill. |
| `allow` frame from a crane | A new frame type on the socket | Outbound on the existing connection; same size caps and same bearer as `cmds`. Not a port. |

What does **not** move: no inbound port on the crane, no chat through
Gantree, no yard cookie on the Worker, no Cloudflare API token on a
crane, no MCP OAuth token doubling as a login.

---

## Not this

| Shape | Why not |
| --- | --- |
| One SSO across yard, Worker, and crane | Three products with one IdP dependency. The Mini must open when Google does not. |
| Gantree pushes `ALLOWED_SUBS` as the human roster | That list is break-glass only. The crane `.env` is still who may talk. |
| Worker as IdP for the yard | Console in the token path’s blast radius. Doc says never. |
| Central user DB (yard sqlite) read by crane or Worker | Harness must not know the yard exists; Worker is on another network. |
| Cloudflare Access on the Worker | 403s WebSocket upgrades; crane is not a browser; a fourth identity system. |
| Pairing codes in chat | Telegram lesson: operational foot-gun. Lists, not handshakes. |

---

## Fit gates

Fail one and the task is later, or it belongs somewhere else.

1. **One human list.** The crane `.env` is the allowlist. The Worker
   enforces what the crane published. Gantree writes it. No fourth
   copy.
2. **Pull and dial, never punch.** The `allow` frame rides the socket
   the crane already opened. No port, no scrape, no timer, no yard
   name inside the harness.
3. **`sub` is the key, verified email is an alias.** Session id and
   `user_id` are always `sub`. Email only ever *matches*; it never
   *identifies*. Exact, lowercased, `email_verified` required.
4. **Fail closed, both ends.** Empty crane list fails boot. Worker
   with no room list admits nobody (static `ALLOWED_SUBS` is optional
   extra, not a fallback that opens the door).
5. **No enumeration.** Every miss is the same `unauthorized`. The only
   identity a stranger sees is their own.
6. **Yard door stays passphrase.** Google is a field on the operator
   and a login on the Worker. Not a yard session, not an IdP hop the
   Mini needs to boot.
7. **Isolation.** Pushing a person onto Kit does not touch Ada’s
   crane. Kit’s bearer cannot name Ada’s humans.
8. **Gantree writes files, and Worker secrets for this mouth only.**
   Admin Settings holds a Cloudflare API token (Workers Edit) and
   pushes Google / session / per-crane bearers. Cranes never get that
   token. The Worker never accepts `gantree_session`.

Stranger walks that still prove this loop, and leftover cleanup across
the three repos:
[docs/todo.md](https://github.com/shotah/gantree/blob/main/docs/todo.md).
