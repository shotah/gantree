# Channel migration — Telegram to pendant

One crane, one `CHANNEL`. This page is how to move **Kit** from Telegram
(or Discord / Slack) onto the pendant without building a second agent.

The yard has no “switch mouth” button. You change `CHANNEL`, mint a
bearer from Kit’s **Pendant** fold, then **recreate**. Same folder, same
`data/gantry.db`, same persona. Telegram on that process goes quiet.

Who may talk, Google `sub`, yank: [access.md](access.md). First-time
Worker + Settings: [operators.md](operators.md) ·
[access.md](access.md#end-to-end). New cranes (not a migrate):
[install.md](install.md).

---

## Same crane vs two mouths

| Want | Do |
| --- | --- |
| Kit herself on the phone, keep her memory | This walk. Change Kit’s `CHANNEL`. |
| Kit still on Telegram **and** a phone mouth | Two processes. [Clone](#keep-telegram-too) Kit, migrate the copy. Memories fork from that stamp. |
| A brand-new pendant crane | Build, channel `pendant`. Not this page. |

The bot token (Telegram / Discord / Slack) can stay in Secrets. It will
not poll while `CHANNEL=pendant`. Paste it back if you ever switch the
mouth the other way.

---

## Before you start

1. **gantry-pendant code** is on Workers (that repo’s CI). Secrets are
   not pasted in the Cloudflare dashboard.
2. Yard **Settings → Pendant** is filled and saved: Cloudflare token,
   account, Worker name, origin, Google Web client. **Save and push**
   must have landed `GOOGLE_*` and `SESSION_SECRET`. The fold shows
   ready. Pointer:
   [access.md](access.md#cloudflare-api-token) ·
   [Google OAuth](access.md#google-oauth-client-gcp).
3. GCP client is a **Web application**. Origin =
   `https://<pendant-origin>`. Redirect =
   `https://<pendant-origin>/api/auth/callback/google`.
4. Ada (the human who will talk) has **email** on her Profile. Leave
   Google blank; the yard learns `sub` after she talks.

If Settings is not ready, Kit’s Pendant fold will refuse the mint with
a pointer back to that page. Do not paste a bearer by hand.

---

## Walk

Examples use **Kit** (crane) and **Ada** (operator / chatter). Same
motion for Discord or Slack: only the old token name differs.

### 1. Email on the person

Ada → header name → **Profile** → email → save. That is what Pendant
matches until Google `sub` is learned. Not a reset path, not a mailbox.

### 2. Point the mouth

Kit → **Secrets** → set `CHANNEL` to `pendant` → save.

**Do not recreate yet.** Empty `PENDANT_ALLOWED_USERS` fails boot.

The Pendant fold appears once `CHANNEL` is pendant (or a mailbox /
bearer is already in `.env`). Changing Secrets does **not** mint a
bearer by itself.

### 3. Who may talk

Kit → **Pendant**. Tick Ada (or paste `ada@example.com`). Confirm-scary
**Save allowlist**.

Someone who is not an operator can still be a chatter: paste their
email. They never need a yard login.

### 4. Mint the mailbox

Confirm-scary **Rotate bearer**. First time is a mint, not a rotation:
the yard writes `PENDANT_MAILBOX_URL` (`wss://…/ws/kit`) and
`PENDANT_BEARER`, merges `kit:<token>` into Worker `CRANE_BEARERS`.
No wrangler. Do not also `secret put` that map from the pendant CLI —
a bulk put can drop yard-minted slugs.

### 5. Recreate Kit

**Recreate**, not restart. Boot reads `.env`, dials the mailbox,
publishes `allow`. Restart keeps a ghost allowlist.

### 6. Phone

Open the pendant origin from Settings. Sign in with Google. Ada should
see Kit and talk.

After a few turns, spend may show a raw `1182…` and offer to store it
on Ada’s profile. Accept; the next allowlist push becomes `sub:email`.

---

## Keep Telegram too

Clone Kit with settings + persona + **database**. The copy is a new
slug. If the source was already pendant, clone mints a **new** bearer
(never copies `PENDANT_BEARER`). If the source is still Telegram,
migrate the clone with the walk above; leave Kit on Telegram.

Two processes, two memories after that stamp. One Completer does not
speak two mouths.

---

## Back to Telegram

Kit → Secrets → `CHANNEL=telegram`. Confirm `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_ALLOWED_USERS` (numeric ids, not `@username`). Recreate.

Pendant keys can stay unused. The Worker still has `kit:<token>` until
you rotate on a pendant crane or destroy Kit (destroy drops the slug
from `CRANE_BEARERS`).

---

## Stuck

| Symptom | What to do |
| --- | --- |
| Pendant fold missing | `CHANNEL` is not `pendant` yet, or Secrets save did not write the file. |
| Crane dies on boot / empty list | Save the allowlist (email is enough), then recreate. |
| Google works, crane list empty | Allowlist not saved, or recreate never ran. Until `/me` lists a crane the phone used to fetch Kit’s avatar (`401` on `/api/avatar?slug=kit`). Type the real slug on that screen, or wait for `pendant allow sent` and refresh. |
| Phone 401 / stuck on Kit | Google is fine. The picker is not yard “assigned cranes” — it is Google email/`sub` → rooms that published `allow`. |
| Worker `503 config` | Settings → Pendant did not land Google / `SESSION_SECRET`. Save and push again. |
| Rotate says not pendant | Secrets still has the old `CHANNEL`. Save `pendant` first. |
| Rotate / Build points at Settings | Cloudflare token, account, Worker name, or origin missing. |
| Sign-in redirect error | GCP client must be Web, redirect exactly `/api/auth/callback/google` on the pendant origin. |
| Telegram still answers | Recreate did not run, or `CHANNEL` never saved. One process, one mouth. |

The yard cookie never goes to the Worker. Ada’s Google login is not a
yard session.
