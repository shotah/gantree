# access — todo

Build script for [access.md](access.md): one person across the yard,
the pendant, and the crane. Design is on that page; this file is what
“done” looks like, the shared contract every repo codes against, then
the milestones in walk order. Three repos, one list — each milestone
names its repo and is shippable alone.

Repos: **gantree** (this checkout), **ai-gantry**
(`repos/ai-gantry`), **gantry-pendant** (`repos/gantry-pendant`).
Nested checkouts are dev only; each keeps its own remote.

Status: **now** · **next** · **later** · **not this version**
A milestone is done when a stranger can do the **walk** without our
house git.

---

## Looks like (the end)

Ada is a person on the yard with an email. Admin opens Kit, ticks Ada
under **pendant allowlist**, confirms, recreates. Ada opens the pendant
on her phone, signs in with Google, sees **Kit** in her crane list, and
Kit answers. No Cloudflare paste. No JWT decoding. One recreate.

Admin unticks Ada, recreates. Her socket closes `4401` on the next
frame. Removing Ada from the yard nags “she is still on Kit’s list.”

The yard still logs in with a passphrase. The Worker never sees the
yard cookie. The crane never learns the yard exists.

**Operator loop that must work end-to-end**

1. Once: GCP Web client, Worker deploy, one bearer per crane in
   `CRANE_BEARERS`. Yard `/setup`.
2. Profile: Ada has an email (and, once learned, a Google `sub`).
3. Kit → pendant panel → tick Ada → confirm → `PENDANT_ALLOWED_USERS`
   written → recreate nag.
4. Recreate. Kit dials, publishes `cmds` then `allow`. The room
   remembers both.
5. Phone: Google → `/api/auth/me` → `cranes: ["kit"]` → talk.
6. Spend on the yard names Ada; if the `sub` was unknown, it offers
   to store it on her profile.
7. Yank: untick, recreate, `4401`. Emergency: rotate the bearer.

If that loop is “paste the same 21 digits in three places,” we missed.

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
8. **Gantree writes files, not Cloudflare.** No CF API token on the
   Mini. The Worker never accepts `gantree_session`.
9. **Backward compatible per slice.** Old crane + new Worker and new
   crane + old Worker both still work with the pasted lists until
   every repo has landed.

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

Room → crane, unchanged shape plus `email`:

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
list is a valid answer for a signed-in stranger.

### Gantree operator row

`channels` grows `google: string[]` (digits, same caps as Telegram,
`MAX_CHANNEL_IDS`). Email already exists. Push writes `sub:email` when
`google` is set, `email` when it is not.

---

## Ships

| Repo | Surface | What “done” means |
| --- | --- | --- |
| ai-gantry | `PENDANT_ALLOWED_USERS` | Grammar above. Email entries admitted. Empty fails boot. |
| ai-gantry | `allow` frame | Published after `cmds` on every dial. Normalized list. |
| ai-gantry | inbound `email` | Frame field read; `isAllowed(sub) || isAllowed(email)`. |
| gantry-pendant | Room allowlist | DO stores `allow`; handshake + per-frame check; `4401` on removal. |
| gantry-pendant | Auth mode | `ALLOWED_SUBS` optional. Google + `SESSION_SECRET` + `CRANE_BEARERS` required. |
| gantry-pendant | Session for verified | Callback mints for any verified Google account; opens nothing. Rate-limited. |
| gantry-pendant | Directory | KV index; `/api/auth/me` returns `cranes`; phone picks from a list. |
| gantree | Profile | Google `sub` field, hint already in `lib/yard/hints.ts` (`chatGoogle`). |
| gantree | Pendant panel | Allowlist editor + “add this operator” + recreate nag + audit. Twin of `TelegramBot.tsx`. |
| gantree | Spend | `user_id` → display name via `google`; suggest storing an unseen `sub`. |
| gantree | Leave nag | Removing an operator lists cranes still carrying them. |
| docs | Three repos | Pendant `setup.md` / `edgecases.md` say “one recreate”; contract page lists email entries. |

**Not this version:** Google login on the yard, Link-Google hop,
Workspace `hd` gate, Gmail dot/plus normalization, Cloudflare Access,
push notifications, pairing codes, a CF API token in the yard, Sign in
with Apple.

---

## Now

Nothing has landed. Today is the pasted-lists path in the pendant
`setup.md` (Worker `ALLOWED_SUBS` + crane `PENDANT_ALLOWED_USERS`,
same `sub`, decode a JWT for the first human). Keep using it until
M2 ships; M1 alone does not change the operator’s day.

---

## M1 — ai-gantry: the crane says who may talk (next)

Harmless to a Worker that ignores the new frame. Land first.

- [ ] `internal/channel/pendant`: parse entries per the grammar.
      `normalizeSub` becomes `parseEntry` → `{sub, email}`. Email
      lowercased. Bad entry = boot error naming the entry. Empty =
      today’s error.
- [ ] `isAllowed(sub, email string)`: either matches. Trim both.
- [ ] Inbound frame: read `email` next to `user_id`. Missing is fine.
      Session id stays `pendant:<slug>:<sub>`; never key on email.
- [ ] Outbound: `allowFrame()` next to `cmdsFrame()`. Send after
      `cmds` on every successful dial. Same write path, same caps.
- [ ] Spark / cron `Push` keeps `ChatID = sub`. Nothing changes for
      outbound.
- [ ] `.env.example`: `PENDANT_ALLOWED_USERS=` comment shows all three
      forms.
- [ ] `docs/gantree-contract.md`: one line — console may write emails
      into `PENDANT_ALLOWED_USERS`.
- [ ] Tests: grammar table (each row + junk + empty), `isAllowed` by
      sub, by email, by neither; dial publishes `cmds` then `allow`;
      inbound with email-only match reaches the handler with `UserID`
      = sub.
- [ ] **Walk:** `PENDANT_ALLOWED_USERS=ada@example.com` boots. Logs
      show `allow` sent after dial. A frame with that email and a
      fresh `sub` is answered; a frame with neither is dropped.

---

## M2 — gantry-pendant: the room enforces the crane’s list (next)

After this the Cloudflare paste per human is gone.

- [ ] `worker/mailbox.ts`: on crane frame `kind: "allow"`, validate
      (array, ≤ 64 users, each `sub` digits and/or email string),
      store on DO storage like `cmds`. Ignore from a phone socket.
- [ ] Admission helper `roomAllows(list, session)`: `sub` match, or
      `email_verified` + lowercased email match. Static
      `ALLOWED_SUBS` still admits (optional extra).
- [ ] Handshake (`lib/auth/handshake.ts` → `oidcHandshake`): phone
      passes if session valid **and** `roomAllows` for this slug (the
      Worker asks the DO, or the DO re-checks on `webSocketMessage`
      as today). Same `unauthorized`.
- [ ] On new `allow`: walk phone sockets, close `4401` any not on it.
      Existing per-frame re-check keeps working.
- [ ] `lib/auth/mode.ts`: `ALLOWED_SUBS` no longer required for
      `oidc`. Still Google + `SESSION_SECRET` + `CRANE_BEARERS`.
- [ ] Callback (`app/api/auth/callback/google/route.ts`): mint a
      session for any **verified** Google identity. Drop `acceptHuman`
      against `ALLOWED_SUBS` from the callback; admission moves to the
      room. Store `email` + `email_verified` in claims.
- [ ] Rate limit the callback and `/api/auth/me` per IP and per `sub`
      (cheap 429). Same shape for every miss.
- [ ] Directory: KV binding (`DIRECTORY`). DO writes
      `sub:<sub>` / `email:<email>` → slug set on `allow`; removes
      itself from keys no longer listed (diff against the previous
      frame). TTL none; rewrite on every dial.
- [ ] `/api/auth/me` → `{ sub, email, cranes }`. Dev mode returns the
      canned user with `cranes: ["ada"]`.
- [ ] Phone (`PhoneShell.tsx`): replace the free-text slug with a
      picker from `cranes`. Empty → “not on any crane yet — give this
      to your yard admin” with email and `sub`, copy button. No `sub`
      on the query string.
- [ ] Stamp `email` on frames to the crane (`stampUserId` gains a
      sibling). `user_id` stays `sub`.
- [ ] Docs: `setup.md` short answer becomes one list; `edgecases.md`
      “dual allowlists” becomes “stale list until recreate”; security
      table adds the room-list row; README env block drops
      `ALLOWED_SUBS` as required.
- [ ] Tests (`test/auth/`, `test/mailbox/`): mode without
      `ALLOWED_SUBS`; handshake by `sub`, by verified email, unverified
      email refused, static extra still admits; new `allow` closes a
      removed socket `4401`; directory add/remove diff; `/me` for a
      stranger is `cranes: []` and never 401.
- [ ] **Walk:** unset `ALLOWED_SUBS`. Crane with
      `PENDANT_ALLOWED_USERS=ada@example.com` dials. Ada signs in, sees
      Kit, talks. Bob signs in, sees no cranes and his own id. Recreate
      Kit without Ada: her socket closes `4401`.

---

## M3 — gantree: people write the list (next)

Twin of the Telegram push that already exists. `lib/yard/crane/telegram.ts`
`saveGantryAllowlist` is the pattern; `app/components/crane/TelegramBot.tsx`
is the UI to mirror.

- [ ] `lib/yard/door/channels.ts`: `OPERATOR_CHANNEL_KINDS` gains
      `google`. Digits-only (`/^\d{10,32}$/`), `@` rejected with
      “needs the Google sub, not the email.” Same `MAX_CHANNEL_IDS`.
      Existing rows parse with `google: []`.
- [ ] Profile UI (`app/components/operators/`): Google field using
      `HINTS.chatGoogle`. Email hint says it is what the pendant
      matches until the `sub` is learned.
- [ ] `lib/yard/crane/pendant.ts`: `cranePendantAuth(g)` (channel,
      mailbox URL, bearer present?, allowlist parsed per the grammar)
      and `saveGantryPendantAllowlist(slug, entries)` → writes
      `PENDANT_ALLOWED_USERS`, returns “recreate to apply.” Refuses
      when `CHANNEL` is not `pendant`. Entries from an operator:
      `sub:email` if `google` set, else `email`; refuse an operator
      with neither.
- [ ] Route `app/api/gantries/[slug]/pendant/route.ts`: GET status,
      PUT allowlist. `withDoor`; `user` / admin on that crane only;
      `readonly` GET. Audit row `pendant.allowlist` (who, slug, count).
- [ ] `app/components/crane/PendantPanel.tsx`: allowlist editor,
      operator checkboxes (email shown, `sub` badge when known),
      free-text extra entries, Save → recreate nag (`HINTS.envRecreate`).
      Suggest `user_id`s seen in slog that are on no entry.
- [ ] `BuildCrane.tsx` pendant step: operator checkboxes feed the
      allowlist textarea. Same for Telegram while there (ids on
      profile).
- [ ] Spend (`lib/yard/observe/spend.ts`): resolve `user_id` through
      `channels.google` too. When a `user_id` matches nobody but the
      crane list has an email entry and exactly one operator holds
      that email, surface “store `1182…` on ada’s profile” — a button
      on the crane, admin or that operator. Suggest ≠ write.
- [ ] Leave nag: `removeOperator` path lists cranes whose
      `PENDANT_ALLOWED_USERS` / `TELEGRAM_ALLOWED_USERS` still carry
      their ids or email. Shown in the confirm-scary modal. Not an
      automatic cross-crane edit.
- [ ] Docs: `operators.md` Profile bullet (Google `sub`, what email
      matches); `console.md` pendant panel; `security.md` Operators
      section gains the field; `access.md` “today” table flips to
      “done” rows.
- [ ] Tests (`test/yard/door/`, `test/yard/crane/`, `test/app/`):
      channel parse accepts digits, rejects email/`@`; push writes
      `sub:email` vs `email`; not-pendant refused; `readonly` PUT 403;
      audit row present; spend resolves by `google`; suggestion fires
      once and only for a single-operator email match; leave nag lists
      the slug.
- [ ] **Walk:** partner has an email on Profile, no `sub`. Admin ticks
      them on Kit, recreates. Partner signs in on the pendant, talks.
      Kit spend shows a raw `sub` with “store on partner’s profile.”
      Accept. Next push writes `sub:email`. Tryout’s list unchanged.

---

## M4 — cleanup across the three (later)

- [ ] Pendant: drop `ALLOWED_SUBS` from README env block and setup
      checklist; keep one line under “break-glass.”
- [ ] Pendant: `acceptHuman` and `allowlistMap` only used by the
      static extra; delete if unused.
- [ ] ai-gantry: `normalizeSub` gone; `parseEntry` shared by boot and
      tests.
- [ ] gantree: `lib/yard/hints.ts` `chatGoogle` finally has a field;
      `PENDANT_ALLOWED_USERS` hint shows all three forms.
- [ ] All three: a “stolen phone” paragraph that agrees (OS lock →
      Google sign-out → untick + recreate → rotate bearer).
- [ ] **Walk:** a stranger with the three READMEs and no chat history
      stands up Kit for two humans, yanks one, and never opens the
      Cloudflare dashboard after the first bearer paste.

---

## Later

- Link Google on `/profile`: OIDC hop whose only output is `sub` +
  verified email onto your own row. Loopback / HTTPS origins only.
  Not a session.
- Workspace `hd` gate on the Worker (household on one domain).
- Bearer registration without the Cloudflare paste (yard key on the
  Worker). Only if five cranes make one paste each feel like a
  product gap.
- Telegram: same operator-checkbox push in the wizard.

## Not this version

Google login on the yard. SSO across the three. Cloudflare Access on
the mailbox. Pairing codes in chat. A central user DB any other repo
reads. Gantree writing Worker secrets. MCP OAuth as a phone login.
