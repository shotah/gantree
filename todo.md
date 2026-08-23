# gantree — todo

Work backwards from the current ship. This file is the build script:
what “done” looks like, then the milestones in the order we walk them.
Pitch (the crane is the product) lives in [README.md](README.md). Board
walk: [docs/console.md](docs/console.md). Stack and host I/O:
[docs/architecture.md](docs/architecture.md). Harness-side note:
[repos/ai-gantry/docs/gantree.md](repos/ai-gantry/docs/gantree.md).

KISS / MLP: just enough to run the yard. Vinext + TypeScript only.
`npm start` is the process. No `gantree` CLI and no second language
until a real gap forces it.

v1 walk: milestones 0–11. v2 walk: after the heading **v2 looks like**.
The door (v2 M0) may overlap leftover v1 walks — home LAN already
publishes `:3000` with no login.

Status: **now** · **next** · **later** · **not this version**
A milestone is done when a stranger can do the **walk** without our house git.

---

## v1 looks like (the end)

One runtime: Linux + Docker + Vinext on **Node on the Docker host**.
Two install stories, same console.

**Home.** Open Gantree on the Mini (`127.0.0.1` or Tailscale). Three
named cranes. Click Kit: **that crane’s** dashboard — CPU/RAM and
turn graphs, plus a visual log (not a raw dump). Enable Google. OAuth
in a browser. Recreate. `/tools` in Telegram shows `google__…`.
No toml archaeology. No SSH folklore at 11pm.

**Cloud.** Same app on a small VM (`/opt/gantree` + compose).
`npm start` (or the console container). Tailscale or Cloudflare
Tunnel from a laptop. Build a `slim` crane. Laptop OAuth. Same Tools
screen. Agents still have **no inbound ports**. Cast is hidden.

**Operator loop that must work end-to-end**

1. `npm start` (or compose) on the Docker host
2. Board shows every gantry in `gantree.toml` — alive or not
3. Click a card: per-instance graphs + visual logs (Kit ≠ partner ≠ tryout)
4. Build a crane (yard type → slug → model → channel → profile)
5. Grant / revoke MCP; files update; container recreates
6. Watch *that* agent’s log and metrics until the grant is real
7. Doctor says why something is skipped (no binary / no key / no OAuth)

If that loop is a nicer rsync, we missed. The product is the shipping
yard you can *see*.

---

## Fit gates

If a task fails a gate, it is later or it belongs in `ai-gantry`.

1. **Files are truth.** The UI is an editor of `gantree.toml`,
   `mcp.toml`, `.env`, persona files. No second inventory DB in v1.
2. **Pull, don’t punch.** Gantry stays outbound-only. No `/metrics`
   port on the crane. Graphs sample Docker stats + JSON slog; logs
   stream from `docker logs`. Doctor from files + `gantry status`.
   One page per instance — never a mixed fleet log.
3. **One mutation path.** Route handlers call `lib/yard`. Never
   dockerode from a React Server Component.
4. **One language.** TypeScript. Vinext on Node. The harness is
   already Go — this repo does not grow a second CLI in a second
   language. `npm start` / `vinext start` is enough.
5. **Node on the host.** Vinext `--platform=node` / standalone.
   Workers is a later portal, not v1.
6. **Bind localhost.** `127.0.0.1` by default. Tailscale / Tunnel if
   you leave the box. Never a public load balancer.
7. **Isolation.** One human, one bot, one directory, one `data/`.
   Delete a tryout = delete that directory.
8. **Not chat.** Telegram stays the mouth. No pairing the agent
   through the console.
9. **Import over write.** dockerode, compose, Vinext. Don’t invent a
   Docker client.
10. **Meh yard, tight crane.** Gantree is JS in a browser. That stack
    will never be as fast as the Go harness — and that is fine. The
    operator can wait 200ms for a chart. The human on Telegram cannot
    wait for a serial tool loop. Never sit in the token path. Never
    add a listen port, a scrape, or a hook that taxes parallel tool
    calls, Completer rounds, or RSS. If a dashboard want would make
    `ai-gantry` slower, the want is wrong. Parse what the harness
    already logs. Do not invent instrumentation for prettier graphs.

---

## v1 ships

| Surface | What “done” means |
| --- | --- |
| Yard home | Cards: name, alive, model, channel, published vs skipped MCP, last error, last turn; optional sparklines |
| Agent dashboard | Per instance: metric graphs + visual logs. Kit’s page is only Kit. |
| Build crane | Wizard: home vs cloud, slug, persona seed, model, channel + token + allowlist, `slim` / `life` / `life-cast` |
| Tools | Catalog + custom binary; toggle writes `[[server]]`, `tools-fetch`, recreate; “needs auth” is a button |
| Persona + secrets | Markdown editor; `.env` form; token push explicit and scary; never copy `data/` by default |
| Run | Start / stop / recreate; live visual log; image pin; backup `gantry.db` + `SELF.md` |
| Process | `npm start` / `vinext start` (or compose). Bind `127.0.0.1`. |
| Install | Home Mini compose, or cloud VM like `examples/hosting` |

**Not v1:** operator login, Workers portal, systemd yards, token-expiry
nags, yard sqlite, a `gantree` CLI / Go binary, hosted SaaS,
Kubernetes, shared family brain, agent chat in the console.
Those that belong here live under **v2** (or **Later**, after v2).

---

## Now

Docker is live. Built cranes `kit` + `tryout` (`shotah/ai-gantry:latest` pin,
stdio) via the UI API. Board, doctor, structured logs, stats, MCP/uptime
charts, paste-code auth, recreate wait-for-doctor. Open
`http://127.0.0.1:3000`.

Still needs a human: live Google OAuth, recreate-while-Telegram-answers,
stranger walks. New cranes pin `shotah/ai-gantry:latest`. Existing kit/tryout
keep their old compose tag until you pin/recreate.

**Pitch shots** (GitHub / README). The case is live. Strangers still need
to *see* the loop, not only the door:

- [x] Login (cropped tight) + yard board
- [x] Recapture the board with **live** cranes — model, channel, MCP
      published (`assets/yard.png`). last turn stays empty until a chat.
- [x] Crane dashboard: CPU/RAM + MCP + uptime from live Ada
      (`assets/crane-metrics.png`, `assets/metrics.png`). Token / completer
      charts stay empty until a chat — not invented.
- [ ] Telegram: one multi-step turn with tool trace — the mouth
      (Garmin → sheet → Strava, or contacts + calendars → create). Not a
      chat mock inside this UI.

The Telegram shot is how a stranger believes the runner. Do not invent
it. Capture from a real Kit.

---

## Milestone 0 — repo + Vinext on Node

Empty console that boots on the Docker host. No gantries yet.

- [x] Public repo `shotah/gantree`, MIT, README pitch
- [x] `repos/` nested checkouts (gitignored, `.gitkeep`); `ai-gantry` stacked
- [x] This todo (v1 end-state + walk order)
- [x] `npx vinext create --platform=node` (or equivalent) → `app/`
- [x] TypeScript strict (`npm run typecheck`); tests via vitest
- [x] `lib/yard/` — dockerode only imported from API / yard modules
- [x] `npm start` → `vinext start` (dev: `npm run dev`)
- [x] Bind `127.0.0.1` by default (`vinext start -H ${HOST:-127.0.0.1}`)
- [x] Compose for the console itself (`compose.yml` + Dockerfile)
- [x] CI: typecheck + unit tests + build
- [x] **Walk:** `npm start`, browser opens a blank yard on localhost
      (proven here; Docker socket missing so the board is empty + honest error)

---

## Milestone 1 — see one crane

First useful product: one existing container, alive or not, and its logs.
Attach to a crane that was started by hand (today’s compose). Do not
build a new one yet.

- [x] dockerode behind `lib/yard`
- [x] Discover: name, state, image, started-at, health
- [x] `GET` logs (last N) + live tail (SSE)
- [x] Parse JSON slog lines when present
- [x] Read-only file peek: `mcp.toml` / `.env` key names (via `gantree.toml` paths)
- [x] Route handlers only — `app/api/…` calls `lib/yard`
- [x] **Walk:** built crane `kit` — status + JSON slog logs via API. No SSH.

---

## Milestone 2 — inventory + board

A handful of named pets, not a Kubernetes dashboard.

- [x] `gantree.toml` / `gantree.toml.example` — ids, slugs, container, dirs.
      No secrets.
- [x] `lib/yard.list()` merges toml + Docker inspect (or discover)
- [x] Yard home UI: one card per gantry
- [x] Card: name, alive, model, channel, MCP listed (best-effort)
- [x] Click-through to that instance’s dashboard (M3)
- [x] **Walk:** `kit` + `tryout` cards from `gantree.toml` + Docker inspect.

---

## Milestone 3 — per-agent dashboard (graphs + visual logs)

Each `ai-gantry` instance gets its own page. This is why the console
exists at 11pm: *this* crane, *this* turn, *this* spike — not a
shared syslog.

Still pull-only. Sample while Gantree is up. No Prometheus in v1.
No port on the harness.

**Graphs** (import a chart lib — Recharts / uPlot / similar)

- [x] Sample `docker stats` into a **per-slug ring buffer** (in memory)
- [x] Host: CPU %, memory
- [x] Turn: Completer rounds, recoveries, est. tokens from JSON slog
      (`turn perf` → `prompt_est_tokens` + `gen_est_tokens`, not `est_tokens`)
- [x] MCP: published vs skipped over time (from doctor / status)
- [x] Restarts / uptime chart (inspect has startedAt; no chart yet)
- [x] Board sparklines optional
- [x] Missing slog fields stay empty — don’t fake a line
- [x] Yard spend: combined est. tokens + per-crane ranking + per-user when
      `user_id` is on `turn perf`

**Visual logs** (one stream per instance, never mixed)

- [x] Structured viewer: time, level, message
- [x] Live tail (SSE) + last-N backfill
- [x] Filter: level, text search, tool / skip / error highlights
- [x] Group by turn when a turn id (or equivalent) is in the line
- [x] Pause / follow; redact `.env`-shaped values
- [x] Kit’s log URL is `/gantries/:slug/…` — other slugs are other containers

- [x] **Walk:** kit stats sampled (CPU/mem + est_tokens from slog);
      logs are kit-only. Stop/flatline not auto-run (shared state).

---

## Milestone 4 — doctor

“Healthy container, zero tools” is a fail. The console says *why*.

- [x] Per-gantry doctor: Docker health + `gantry status` exec + files
- [x] Checks: persona present, `mcp.toml` listed, required env keys (names),
      oauth session file best-effort
- [x] Distinguish process dead vs missing env vs needs-auth hint
- [x] Harness `gantry status` JSON (parse here; pin bump still needed)
- [x] **Walk:** kit doctor: process running, PERSONA.md, slim grant listed.

---

## Milestone 5 — run

Start / stop / recreate. Env change **recreates** (restart keeps ghost
allowlists).

- [x] `lib/yard` start / stop; recreate = remove + create with current env/files
- [x] Recreate / pin keep host uid:gid (not Distroless 65532), network_mode, extra binds
- [x] Image pin (pull Hub tag + recreate)
- [x] Recreate waits until doctor is green-or-honest, not just “started”
- [x] Backup: copy `gantry.db` + `SELF.md` to `backups/<stamp>` (no `.env`)
- [ ] **Walk:** recreate from the UI while Telegram still answers (stdio planted).

---

## Milestone 6 — files are the editor

UI writes the same files you would hand-edit. Still no build-crane wizard.

- [x] Read / write `mcp.toml` via grant/revoke (structured catalog)
- [x] Read / write `PERSONA.md`; show `SELF.md` with a prune hint
- [x] Secrets form → `.env`; values never returned after save
- [x] Form scoped to crane mouth + **granted** MCP keys only (no fleet dump)
- [x] MCP shape from `<binary> host-manifest` (gantree list only; no hardcoded keys)
- [x] Token push requires `confirmToken`
- [x] Backup / recreate never copies `data/`
- [x] **Walk:** files API lists kit servers + masked env keys.

---

## Milestone 7 — Tools (the killer screen)

MCP **is** the grant. This is the screen v1 is for.

- [x] Catalog of known servers (google, search, math, garmin, …)
- [x] Toggle on → write `[[server]]`; tools-fetch button; recreate separate
- [x] Toggle off → omit from manifest
- [x] Per server: env keys + **needs auth** button (`gantry auth`)
- [x] Profiles as build-time menus (`slim` / `life` / `life-cast`)
- [x] **Walk:** kit built slim — mcp.toml lists google-search + math.

---

## Milestone 8 — auth hop

“Needs auth” is a button, not a wiki page.

- [x] Detect needs-auth from catalog `auth_args` when granted
- [x] Button runs `gantry auth <server>` in the container
- [x] Paste-code UX after `/auth` in chat
- [x] Hide / refuse `life-cast` when yard type is cloud (build rejects)
- [ ] **Walk:** live Google OAuth (needs real tokens).

---

## Milestone 9 — build a crane

New crane in two minutes, not an afternoon of compose.

- [x] Wizard: **yard type first** (home Mini vs cloud VM)
- [x] Then: slug, model, channel + token + allowlist, profile
- [x] Writes `gantries/<slug>/` + compose.yml + gantree.toml
- [x] Creates/replaces the container (image pull best-effort)
- [x] Isolation: one directory per slug
- [x] **Walk:** built cranes `kit` + `tryout` slim via POST `/api/gantries`.

---

## Milestone 10 — two yards, one product

Same console. Host chosen at build / init time.

- [x] Home: compose on the box, `npm start`, console on `127.0.0.1`
      or Tailscale. Cast allowed.
- [x] Cloud: same stack on a VM, layout in the spirit of
      [ai-gantry examples/hosting](repos/ai-gantry/examples/hosting)
      (`/opt/gantree`, compose, CI pulls the harness image)
- [x] Console never `0.0.0.0` on the public internet
- [x] Cloud docs: Tailscale or Cloudflare Tunnel to Gantree only
- [x] Hub image `shotah/gantree` (Actions → Docker Hub + GHCR); `npm run release`
- [ ] **Walk (home):** stranger clones this repo, `npm start`, builds
      one crane in the UI, grants search, chats on Telegram.
- [ ] **Walk (cloud):** same from a laptop over Tailscale. No Cast.
      Agents have no inbound ports.

---

## Milestone 11 — hello path

A stranger does either story without reading anyone’s private git.

- [x] Root README hello: clone → `npm start` → attach or build a crane
- [x] No `.env` or `data/` copied from a private checkout
- [x] Pin `shotah/ai-gantry:latest`; nested `repos/ai-gantry` is
      **dev only**
- [x] Screenshot / short clip of the board + one agent dashboard
      (graphs + visual log) + Tools
- [ ] **Walk:** the two “done looks like” stories above, from a clean
      machine.

---

## Push into ai-gantry (when every consumer benefits)

Do these in the harness repo, not here. Gantree consumes them.

Nested checkout (dev only):
[repos/ai-gantry/gantree_todo.md](repos/ai-gantry/gantree_todo.md) ·
[repos/ai-gantry/docs/gantree-contract.md](repos/ai-gantry/docs/gantree-contract.md).

Shipped in the harness (needs an image pin bump before Mini cranes emit it):

- [x] Richer `gantry status` / `doctor`: JSON — channel, each MCP connected vs
      skipped, auth yes/no, persona files present
- [x] Operator `ok` is false when the manifest is all skipped (Docker exit
      code stays heartbeat so chat-only does not restart)
- [x] Tool errors a model *and* a UI can tell apart: `no_binary` vs `no_key`
      vs `no_oauth`
- [x] Stable JSON slog fields for turns / tokens / recoveries so the
      dashboard graphs are not regex soup (`turn perf`: `prompt_est_tokens`,
      `gen_est_tokens`, `iterations`, `recoveries`; gantree consumes them)
- [x] `user_id` + `session_id` on `turn perf`
- [x] Stable file/env contract docs the console can write against

The harness never learns instance names. Gantree never sits in the
token path of a chat turn. Consume slog / `status` the crane already
emits. Do not ask the harness to grow dashboard hooks.

- [x] **Here:** pin Hub image to `shotah/ai-gantry:latest` (one constant,
      not a semver chase). Existing cranes keep their compose tag until you
      pin/recreate.

---

## v2 looks like (the end)

v1 is a yard you can *see* if you can *reach* the process. v2 is the
same yard with a **door**, a **memory**, and a **nag** before a grant
goes dark. Chat still stays Telegram. Agents still open zero inbound
ports. Still your box — not a SaaS.

**Home.** Open `http://<mini-lan-ip>:3000`. A login page. You and one
other operator (a partner). Same board, same Tools, same recreate.
Graphs survive bouncing `npm start`. A badge on Kit: Google needs
re-auth — click through, hop, done. LAN bind is fine; the neighbor’s
phone is not.

**Cloud.** Same VM, still no WAN firewall hole. Tailscale in, *then*
login. A stolen laptop on the tailnet is not enough. Optional:
Cloudflare Access / Tailscale identity in *front*; Gantree still has
its own session so the Node process is not a naked API.

**Portal (last walk).** The same `app/` on Workers, talking to the
host console. `docker.sock` never leaves the Mini. The portal is a
second skin, not a second inventory.

**Operator loop that must work end-to-end**

1. First boot: create the first operator (setup). No operators +
   listen-on-all-interfaces is fail-closed, not a silent open yard.
2. Login → httpOnly session. Unauthenticated `/api/*` and log SSE
   are 401. Logout works.
3. Add a second operator from the UI (hashed, gitignored). They see
   the same yard.
4. Restart the process: session is gone until login; Kit’s charts
   still have last week’s turns.
5. Skip Google on purpose: the board nags without opening Tools.
6. Partner recreates a crane: you can see *who* did it.
7. (Last.) Laptop hits the Worker; host stays loopback.

If that loop is “basic auth on Caddy and hope,” we missed. The product
is a yard you can put on a LAN without trusting everyone on it.

---

## v2 fit gates

v1 gates still hold. Deltas:

1. **Inventory stays files.** `gantree.toml` / `mcp.toml` / `.env` /
   persona are still the cranes. v2 may keep **sessions + an event
   log** in sqlite. That is not a second inventory. Do not move slugs
   into sqlite.
2. **Operators live in yard sqlite.** Hashed passphrases in `gantree.db`
   (WAL, gitignored, never a crane’s `data/gantry.db`). No signup, no
   email, no IdP required. Forgot password = delete the operators (or
   the file) and run setup. `node:crypto` scrypt — don’t write a hash.
3. **Every route is a door.** Pages, `/api/*`, log SSE. Exceptions:
   login, setup, static assets. Cookie: httpOnly, SameSite — not a
   JWT in localStorage.
4. **Equal operators, tiny yard.** A handful of people who own the
   box. No teams, no orgs, no SSO. A `view` role is allowed if it is
   one field; twelve-role RBAC is not v2.
5. **Open bind needs a door.** `HOST=0.0.0.0` / compose LAN publish
   without at least one operator (or a live setup that *only* accepts
   that first create) is dishonest. Login does **not** make
   WAN-open-3000 a good idea on a cloud VM. Cloud still pins
   loopback + tunnel; the door is defense in depth.
6. **Portal does not get the socket.** Workers (or any remote skin)
   call the host. Host I/O stays `lib/yard` on Node. The portal must
   not grow a Docker client. Operator cookies authenticate to the
   *skin*; the host trusts a machine token, not a browser.
7. **Nags parse, they don’t poll the model.** Skipped MCP / dead
   OAuth from doctor + files. No new harness hook that taxes a turn.

---

## v2 ships

| Surface | What “done” means |
| --- | --- |
| Login | Setup first operator; login; logout; session on every API + SSE |
| Operators | Add / remove / change passphrase. Cannot delete the last one. |
| Bind | LAN `:3000` is an explicit choice *behind* login; cloud still loopback |
| Board nags | Skipped MCP / needs-auth / dead token visible on the yard home |
| Yard memory | sqlite event log; graphs survive restart; inventory still toml |
| Audit | Mutations (grant, recreate, env, operator edits) record who |
| Portal | Last walk: Workers skin, host on loopback, same operators |

**Not v2:** hosted SaaS, Kubernetes, billed-provider invoices,
Prometheus, a `gantree` CLI, systemd as the install story, pairing
chat through the console, a shared family brain.

v2 *ships* when the host-yard loop (door → operators → nags → memory
→ audit) is a stranger walk. The portal is the last milestone, not a
blocker for calling the door done.

---

## v2 now

**M0–M4** are in the tree (door, operators, board nags, sqlite graph
memory, audit). Close leftover v1 walks (live Google OAuth,
recreate-while-Telegram-answers, stranger hello) as you go — they
are still how a stranger knows v1 is real. Pitch shots (live board,
crane metrics, Telegram trajectory): see **Now**. Portal (M5) is the
last walk.

Home compose publishes `:80` on the LAN *behind* login. First boot is
`/setup`. Cloud VM still `GANTREE_LISTEN=127.0.0.1`.

---

## v2 Milestone 0 — the door

First useful v2 product: the yard is no longer whoever-can-load-the-
page. One operator, a login page, every mutation gated.

- [x] Yard `gantree.db` (WAL sqlite, gitignored). Independent of each
      crane’s `data/gantry.db`. `gantree.toml` stays inventory, no secrets.
- [x] `node:crypto` scrypt. Never store plaintext. Never log the passphrase.
- [x] First-boot **setup** page when there are no operators: create the
      first operator. Until that exists, the only POST that works is
      setup. Everything else 401s.
- [x] Login page; logout; session cookie (httpOnly, SameSite,
      secure-when-HTTPS). Idle 7d / absolute 30d.
- [x] Gate `app/` pages + `/api/*` + log SSE in one place
      (`lib/yard/door` — still not dockerode from an RSC).
- [x] Fail-closed bind: warn when `HOST=0.0.0.0` while operators is
      empty; setup is the only live door. Forgot password → delete
      `gantree.db` (or `var/gantree.db` under compose) → setup again.
      No email reset.
- [x] Tests: unauthenticated list/recreate/env is 401; setup →
      login → list is 200; bad password is not a user-enumeration
      novel.
- [x] Docs: [install.md](docs/install.md), [headless.md](docs/headless.md),
      compose comments. LAN is OK *behind* login. Cloud VM still
      `GANTREE_LISTEN=127.0.0.1`. Screenshots: `assets/setup.png`,
      `assets/login.png` (README + install + headless).
- [ ] **Walk:** compose on the Mini, LAN IP, logged-out browser
      cannot read logs or `.env`. Setup one operator. Login. Board
      works. Restart. Must log in again.

---

## v2 Milestone 1 — a handful of operators

You and a partner. Not a user-admin product.

- [x] Operators screen: add, remove, change own passphrase.
      Confirm-scary, like token push. Hashes never round-trip.
- [x] Cannot delete the last operator. Cannot remove yourself if
      you are the last.
- [ ] Optional one-field `role = "view"` (read board / logs /
      doctor; no grant, recreate, env, operators). Skipped this
      walk — equal operators is enough.
- [ ] **Walk:** add a partner. They log in on a phone. Same yard.
      Remove them. Their next request is 401.

---

## v2 Milestone 2 — nags

The board tells you before 11pm. Still pull-only.

- [x] Yard home: per-card badge for skipped MCP, needs-auth, dead
      process — without opening Tools.
- [x] Token-expiry / oauth-file-missing uses doctor + files (same
      signals as today, surfaced).
- [x] Consume richer `gantry status` JSON when present (parse, do not regex
      `"ok":false`). File-based hints remain until the Hub pin ships it.
- [ ] **Walk:** yank `google-oauth.json` (or ungrant). Board nags
      on Kit. Re-auth hop. Badge clears.

---

## v2 Milestone 3 — yard memory

Graphs that survive a bounce. Inventory still toml.

- [x] sqlite next to the yard files (gitignored, not in `data/` of
      a crane). Turns and samples. v1 ring buffer stays the live
      window. Doctor stays a live pull (not a stored series).
- [x] Per-crane dashboards read history from sqlite after restart.
      Missing data stays empty — don’t fake a line.
- [x] Retention cap (7 days, plus per-slug row caps). This is a Mini,
      not a metrics company. No Prometheus in v2.
- [ ] **Walk:** use Kit for a day, `docker compose restart`, open
      Kit: last day’s turns are still there. `gantree.toml` still
      lists the slugs.

---

## v2 Milestone 4 — who did that

Mutations have an operator, not just a timestamp.

- [x] Audit log in the same sqlite: grant / revoke, recreate, env
      save, operator edits, setup. Actor = session operator.
- [x] Small UI: last N on the crane page and a yard events
      strip. Not a SIEM.
- [ ] **Walk:** partner recreates Kit. You see their name on that
      event. Logged-out, the audit API is 401.

---

## v2 Milestone 5 — portal (last)

Second skin. Same operators story. Socket stays on the host.

- [ ] Host exposes a **machine** token (file / env, not an
      operator password) for the portal. Browser cookies never
      authenticate cross-origin to `docker.sock`.
- [ ] Same `app/` on Vinext Workers (or the smallest CF skin that
      is still this repo). It calls the host. It does not import
      dockerode.
- [ ] Login lives at the portal when that is the public-ish URL.
      Host can bind loopback only.
- [ ] Cloud docs: tunnel *or* portal, not “open 3000 and hope
      login is enough.”
- [ ] **Walk:** laptop → Worker → Mini on `127.0.0.1`. Board,
      login, grant, recreate. Agents still have no inbound ports.
      Kill the Worker: host UI still works on loopback.

---

## Later (after v2)

- systemd yards, not only compose
- A `gantree` CLI (only if the UI + `npm` scripts are genuinely not
  enough — still TypeScript, not a Go Makefile)
- Prometheus / long-retention metrics store
- GCP / provider usage pull (billed $). v1/v2 spend is chars/4
  estimates from `turn perf` — good for “who burned the budget”,
  not an invoice.
- Cross-agent compare view beyond the board spend ranking
- SSO / OIDC / “log in with GitHub” — not needed while operators
  are a handful of hashed passphrases on disk

## Not the product

- Hosted Gantree SaaS / spinning agents for paying customers
- Cloud Run / Lambda / App Runner
- Kubernetes
- Shared family brain
- Pairing the agent through the console
- Multi-tenant orgs, invite links, billing
- Anything that makes `ai-gantry` slower so this UI looks nicer
