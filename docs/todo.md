# Open items

Shipped design lives in [architecture.md](architecture.md) (stack,
invariants, what the yard is today) and [access.md](access.md) (one
person across yard, pendant, crane). Operator walks:
[console.md](console.md), [operators.md](operators.md),
[security.md](security.md). Pitch: [README.md](../README.md).

This file is what’s left. A box is done when a **stranger** can do the
walk without our house git.

Status: **now** · **next** · **later** · **not this product**

---

## Now — prove what we already built

Code is in. These walks still need a human, a real Kit, or a clean
machine.

### Pitch

- [ ] Telegram: one multi-step turn with tool trace — the mouth
      (Garmin → sheet → Strava, or contacts + calendars → create).
      Capture from a real Kit. Do not invent a chat mock inside this
      UI. This is how a stranger believes the runner.

### Console (leftover walks)

- [ ] Recreate from the UI while Telegram still answers (stdio planted).
- [ ] Live Google OAuth on Tools (needs real tokens).
- [ ] **Home:** stranger clones this repo, `npm start`, builds one
      crane in the UI, grants search, chats on Telegram.
- [ ] The two install stories (home Mini / cloud VM) from a clean
      machine.

Cloud over Tunnel / Tailscale already walked. New cranes pin
`shotah/ai-gantry:latest`.

### Access (three repos)

The contract is [access.md](access.md). Nested checkouts are **dev
only**; each keeps its own remote.

- [ ] **Crane `allow` frame:** unset Worker `ALLOWED_SUBS`. Crane with
      `PENDANT_ALLOWED_USERS=ada@example.com` dials. Ada signs in, sees
      Kit, talks. Bob signs in, sees no cranes and his own id. Recreate
      Kit without Ada: her socket closes `4401`.
- [ ] **Yard writes the list:** partner has an email on Profile, no
      `sub`. Admin ticks them on Kit, recreates. Partner signs in on
      the pendant, talks. Kit spend shows a raw `sub` with “store on
      partner’s profile.” Accept. Next push writes `sub:email`.
      Tryout’s list unchanged.
- [ ] **Stranger with three READMEs** and no chat history stands up
      Kit for two humans, yanks one, and never opens the Cloudflare
      dashboard after the first bearer paste.

Pendant Worker **secrets** (Google, session, per-crane bearer) are
pushed from Settings → Pendant (Cloudflare HTTP API, no wrangler).
Human walk still open:
[manage_pendant_cf_todo.md](manage_pendant_cf_todo.md).

---

## Next — gantree

### Backup is a loop

Backup is already a button (`gantry.db` + `SELF.md`). Missing: list,
restore, prune. Destroy already removes a crane (optional files); the
walk still needs “type the slug” if we want that confirm.

- [ ] List stamps under `backups/` (or `backups/<slug>/` if we
      already nest — don’t reshape without a reason).
- [ ] Restore: copy `gantry.db` + `SELF.md` back, then recreate.
      Refuse `.env` / `mcp.toml` / oauth files even if a curious
      stamp contains them.
- [ ] Prune: keep last N or last retain-days, admin. Confirm-scary.
- [ ] Retire confirm: type the slug. Audit: who retired what.
      Isolation: Kit is another directory — it survives.
- [ ] **Walk:** backup Kit. Chat. Restore Thursday’s stamp.
      Recreate. Kit remembers Thursday, not the chat after.
      Token in `.env` is still the live one. Retire tryout: gone
      from the board and from disk. Kit still answers.

### Compare + ask the audit

Kind filter and jsonl download already exist on the event strip. No
who-filter, not a SIEM.

- [ ] Compare fold on the yard home: pick 2–3 cranes, overlay
      tokens (and CPU if we have samples). Logs stay per-instance.
- [ ] Audit extras: who, last N, jsonl for the same query.
- [ ] **Walk:** overlay Kit vs tryout for 7d — Kit burned more.
      Filter events to “recreate” + partner’s name. Export jsonl.
      Logged-out, those APIs are 401.

### Access cleanup (gantree slice)

- [x] `PENDANT_ALLOWED_USERS` hint shows all three forms (`sub`,
      `sub:email`, email). Profile Google field says leave blank —
      the crane never writes `.env`.
- [ ] Stolen-phone paragraph that agrees with the other two repos
      (OS lock → Google sign-out → untick + recreate → rotate bearer).
- [ ] Pendant Cloudflare from Settings + mint bearer on build:
      [manage_pendant_cf_todo.md](manage_pendant_cf_todo.md).

Harness / Worker slices of the same cleanup (drop required
`ALLOWED_SUBS` from their READMEs, unused `acceptHuman` /
`allowlistMap`, `normalizeSub` → shared `parseEntry`) live in those
repos. Don’t duplicate the checklists here.

---

## Later

Do these when a real gap forces it, not because a dashboard fashion
arrived.

- **Workers portal** — same `app/` on Vinext Workers (or the smallest
  CF skin) calling this host. Laptop → Worker → Mini on `127.0.0.1`.
  Login lives at the portal when that is the public-ish URL. Host
  exposes a machine token (file / env, not an operator passphrase).
  Phone layout is someone else’s track; the portal stays with it.
- **Catalog module** — tiles as data Gantree can import. Holes listed
  next to the tile (empty because we don’t parse X). Point tiles at
  series we already sample. Last error / last nag / last-turn age as
  fields. Error log tail as a tile source, not a second log product.
- **One attention surface** — dead + nags + recoveries + last error,
  tag filter, spend window. Empty when the yard is quiet. If this
  page is enough for months, **stop**.
- **Saved watches** — `/dashboards` per operator, drag from catalog.
  Only after named tiles and one real watch exist. Pin-one-as-home
  must not hide the yard from operators who did not pin.
- **Link Google** on `/profile`: OIDC hop whose only output is `sub` +
  verified email onto your own row. Loopback / HTTPS origins only.
  Not a session.
- Workspace `hd` gate on the Worker (household on one domain).
- systemd yards, not only compose.
- A `gantree` CLI only if the UI + `npm` scripts are genuinely not
  enough — still TypeScript, not a Go Makefile.
- Prometheus / long-retention metrics store.
- GCP / provider usage pull (billed $). Spend today is slog tokens
  plus an optional pasted rate — good for “who burned the budget”,
  not an invoice.
- SSO / OIDC / “log in with GitHub” — not needed while operators
  are a handful of hashed passphrases on disk.
- Operator writes on `/boards` (create / pin / check in) — agents
  stay the mouth; the page is read-only.

---

## Not this product

- Hosted Gantree SaaS / spinning agents for paying customers
- Cloud Run / Lambda / App Runner
- Kubernetes
- Shared family brain
- Pairing the agent through the console
- Multi-tenant orgs, invite links, billing
- Google login on the yard. SSO across yard, Worker, and crane
- Cloudflare Access on the mailbox
- Pairing codes in chat
- A central user DB any other repo reads
- Gantree writing Worker secrets **except** pendant config from
  Settings ([manage_pendant_cf_todo.md](manage_pendant_cf_todo.md))
- MCP OAuth as a phone login
- Anything that makes `ai-gantry` slower so this UI looks nicer
