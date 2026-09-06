# Access — who may operate, who may talk

Three repos, three doors, one household. This page is how a **person**
lines up across them: the yard login here, the Google sign-in on the
pendant, and the allowlist the crane actually obeys. It answers one
question: *does the email Gantree writes into a crane’s `.env` become
the list of Google accounts the pendant will let in?*

Today: **no**. Proposed: **yes, through the crane.** What exists, why
it feels disconnected, and the smallest set of changes that pins it
together without merging the three into one product.

Door details: [security.md](security.md). People on the yard:
[operators.md](operators.md). Pendant side (nested checkout, dev only):
`repos/gantry-pendant/docs/setup.md`, `security.md`, `edgecases.md`.
Harness contract: `repos/ai-gantry/docs/gantree-contract.md`.

---

## Why it feels stitched

The three were built independent on purpose. Each has its own idea of
a person, and none of them reads another’s database.

| Piece | Job | Knows a person as | Door |
| --- | --- | --- | --- |
| **gantree** (yard) | Docker + files. Writes crane `.env`, `mcp.toml`, persona. | operator row: name, passphrase hash, role, cranes, email, chat ids | `/login` passphrase |
| **ai-gantry** (crane) | The agent. Reads `.env` at boot. Never learns the yard exists. | allowlist in env: Telegram id, Discord id, Slack id, or Google `sub` | `*_ALLOWED_USERS`, fail closed |
| **gantry-pendant** (mouth) | Cloudflare Worker + Durable Object room per crane. Phone and crane both dial in. | Google `sub` from OIDC; crane by bearer | `ALLOWED_SUBS` secret + `CRANE_BEARERS` |

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
                 email · chat ids
                      |
                      | writes .env       (already: TELEGRAM_ALLOWED_USERS)
                      v
phone -- Google --> Worker room <-- crane (bearer)   CHANNEL=pendant
        ALLOWED_SUBS (secret)      PENDANT_ALLOWED_USERS (.env)
                      |
                      | frame.user_id = sub
                      v
                 ai-gantry Completer
```

Two human lists on the right (`ALLOWED_SUBS`, `PENDANT_ALLOWED_USERS`)
that must agree, and a yard on the left that knows the person’s email
but writes neither of them for the pendant. That is the seam.

---

## What exists today (be honest)

| Question | Today |
| --- | --- |
| Does the yard email reach the crane? | Only as text. **Inject user** copies it into `PERSONA.md` *About you*. It is not a key. |
| Does the yard email reach the Worker? | No. The Worker never talks to Gantree and ignores the yard cookie. |
| Does the crane allowlist reach the Worker? | No. The crane dials in with a bearer and publishes `cmds` (slash catalog). It does not publish who may talk to it. |
| Who decides whether Ada may sign in? | `ALLOWED_SUBS`, a Cloudflare secret you `wrangler secret put` by hand. Unknown `sub` gets no session at all. |
| Who decides whether Kit answers Ada? | `PENDANT_ALLOWED_USERS` in Kit’s `.env`, read at boot. Recreate, not restart. |
| How does Ada learn her `sub`? | She cannot until she is already on `ALLOWED_SUBS`. First human is a laptop job (decode a Google ID token). |
| Can Gantree push a person onto a pendant list? | No. Telegram has the confirm-scary push (`saveGantryAllowlist` writes `TELEGRAM_ALLOWED_USERS`). Pendant does not. |
| Is there a Google id on the operator row? | No. `channels` holds `telegram` / `slack` / `discord`. A `chatGoogle` hint exists in `lib/yard/hints.ts` with no field behind it. |

So for five cranes with five people you keep ten strings in sync across
two hosts, and the yard, which is where you *manage people*, writes
none of the pendant ones.

---

## The principle

**The crane’s `.env` is the one human allowlist. Everything else reads
it.**

- Gantree already writes it (build wizard, Secrets, Telegram push).
- The crane already reads it at boot and fails closed.
- The crane already dials the Worker and publishes state on connect.

So the missing hop is one frame: **the crane tells its room who may
talk to it.** The Worker stops keeping a parallel human list and
enforces the crane’s. Yank a person = edit `.env` + recreate, the same
motion as Telegram today, and the Worker follows on the next dial.

Nothing here gives the harness a port, a yard name, or a settings API.
The frame goes *out* on the socket it already holds.

```text
                gantree (yard)
                operator: email (+ learned sub)
                      |
                      | confirm-scary push → PENDANT_ALLOWED_USERS   (mirrors Telegram)
                      v
                crane .env  ── boot ──► ai-gantry  ── dial ──► "allow" frame
                                                                     |
phone -- Google --> Worker room  ◄── per-room allowlist (remembered on the DO)
                      |
                      | frame.user_id = sub, frame.email
                      v
                ai-gantry checks the same list (fail closed)
```

Two checks of **one** list, written from **one** place.

---

## Key: `sub`, email, or both

Google’s stable id is `sub` (a ~21-digit string). Humans and Gantree
know **emails**. Pick both, with a rule:

| Entry | Meaning |
| --- | --- |
| `118212345678901234567` | `sub`. The key. Survives an email change. |
| `118212345678901234567:ada@example.com` | `sub` with a label. Today’s form. |
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
  `turn perf`; the yard already maps that to a display name for spend
  and already suggests unseen ids. **Learn the `sub` from that, offer
  to store it on the profile.** No one decodes a JWT.

Email-as-alias is what makes “the email on the operator is the
allowlist” true. If you would rather keep `sub`-only (no harness
change), the bootstrap below still works because the phone can now show
the `sub` — it is just one more paste.

---

## What changes, per repo

Each slice is backward compatible and ships alone. Order matters only
for the walk at the end.

### ai-gantry (crane)

- `PENDANT_ALLOWED_USERS` accepts emails as well as `sub` / `sub:email`.
  Empty still fails boot.
- Inbound frame gains `email` next to `user_id`. `isAllowed` checks
  either. Session id keeps `sub`.
- On dial, publish an `allow` frame after `cmds`: the normalized list
  (`sub` and/or lowercased email per entry). Re-publish on reconnect.
  Not on a timer, not on a port.
- Contract page gains one line: the console may write emails there.

### gantry-pendant (Worker)

- The Durable Object remembers the last `allow` frame per slug the way
  it remembers `cmds`. Any phone socket whose `sub` / email is no longer
  on it closes `4401` on the next frame.
- Handshake admits a phone if it is on the **room** list. Keep the
  static `ALLOWED_SUBS` as an optional yard-wide extra (the Cloudflare
  account owner’s break-glass), not a requirement — `resolveAuthMode`
  needs Google + `SESSION_SECRET` + `CRANE_BEARERS` only.
- Google callback mints a session for **any verified Google account**.
  The cookie opens nothing by itself; every room still checks. `/api/
  auth/me` returns `{ sub, email, cranes: [...] }`. Empty `cranes`
  paints “not on any crane yet — give this to your yard admin” with the
  email and `sub`. That kills the decode-a-JWT bootstrap and stays
  no-enumeration (you only see *your own* id). Rate-limit the callback.
- A directory so the phone stops typing `kit`: when a DO stores an
  `allow` frame it writes `sub → slugs` and `email → slugs` to a small
  KV (or one directory DO). `/api/auth/me` reads it. Slug picker becomes
  a list of your cranes.
- `CRANE_BEARERS` stays a Cloudflare secret. One paste per **crane**,
  once, is the price of the Worker trusting the crane. The bearer
  already lets its holder run the whole room, so letting it also name
  who may enter that room adds no reach.

### gantree (yard)

- Operator profile grows a **Google** channel (`sub`). The hint is
  already written; add the field to `channels` with the same shape as
  Telegram (`digits, not the email`). Email already exists.
- Crane pendant panel grows **add this operator to the allowlist** —
  the Telegram twin. Writes `PENDANT_ALLOWED_USERS` as `sub:email` or
  `email`, nags recreate, audits who did it. `user` / admin on that
  crane only; `readonly` looks.
- Spend `by user` already resolves slog `user_id` to a display name via
  profile chat ids; include the Google `sub`. When a `user_id` shows up
  that matches no one but the crane list has an `email` entry, suggest
  “store `1182…` on ada’s profile.” Suggest ≠ write.
- Build wizard **pendant** step: offer operators as checkboxes next to
  the free-text allowlist, same as it should for Telegram.

Gantree still never writes Cloudflare secrets, never chats, and never
sends the yard cookie anywhere.

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

1. Deploy the Worker. GCP **Web application** client, scopes
   `openid email profile`, redirect `https://<origin>/api/auth/callback/google`.
   Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `SESSION_SECRET`, `CRANE_BEARERS`. `ALLOWED_SUBS` optional.
2. Per crane: mint a bearer (`npm run secret` in the pendant checkout),
   append `slug:<bearer>` to `CRANE_BEARERS`. This is the one Cloudflare
   paste per crane.
3. Yard: `/setup`, one admin. Passphrase. As today.

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

No Cloudflare step. No JWT decoding. One recreate.

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
file. Gantree should nag: “ada is on Kit’s pendant list; untick and
recreate.” Isolation stays the feature: no silent cross-crane edit.

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
Gantree, no yard cookie on the Worker, no Cloudflare API key in the
yard, no MCP OAuth token doubling as a login.

---

## Not this

| Shape | Why not |
| --- | --- |
| One SSO across yard, Worker, and crane | Three products with one IdP dependency. The Mini must open when Google does not. |
| Gantree pushes `ALLOWED_SUBS` via the Cloudflare API | A Cloudflare token on the Mini, a second write path, and the Worker still cannot ask the crane who is real. |
| Worker as IdP for the yard | Console in the token path’s blast radius. Doc says never. |
| Central user DB (yard sqlite) read by crane or Worker | Harness must not know the yard exists; Worker is on another network. |
| Cloudflare Access on the Worker | 403s WebSocket upgrades; crane is not a browser; a fourth identity system. |
| Pairing codes in chat | Telegram lesson: operational foot-gun. Lists, not handshakes. |

---

## Order of work

Checklists, the shared contract (entry grammar, frame shapes,
admission table), and a walk per milestone:
[access_todo.md](../docs/access_todo.md).

1. **ai-gantry**: accept email entries; `email` on inbound frames;
   `allow` frame on dial. Harmless to a Worker that ignores the frame.
2. **gantry-pendant**: store `allow` on the DO, enforce per room, make
   `ALLOWED_SUBS` optional, mint sessions for verified accounts, `/me`
   with `cranes`, directory index. Until this lands, keep pasting
   `ALLOWED_SUBS` by hand.
3. **gantree**: Google `sub` on the profile; pendant allowlist push;
   spend suggestion for unseen `sub`; leave-nag.

Then the pendant `setup.md` collapses “three pastes” to one recreate,
and this page becomes the walk. Tests: `test/yard/door/` for the field
and the push, `test/yard/crane/` for the `.env` write, and the pendant
`test/auth/` for room admission by email.
