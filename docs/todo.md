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

v1 walk: milestones 0–11. v2 walk: after **v2 looks like** — **delivered**
(host-yard loop: door → operators → nags → memory → audit). v3 walk:
after **v3 looks like**. Mobile / phone layout is a **parallel** track,
not v3. Portal (v2 M5) stays with that track; it does not block v3.

Leftover v1 walks (live Google OAuth, recreate-while-Telegram-answers,
stranger hello) are still how a stranger knows v1 is real. They are
not the v3 product.

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
      published (`assets/docs/yard.png`). last turn stays empty until a chat.
- [x] Crane dashboard: CPU/RAM + MCP + uptime from live Ada
      (`assets/docs/crane-metrics.png`, `assets/docs/metrics.png`). Token / completer
      charts stay empty until a chat — not invented. `metrics.png` is a tight
      crop of the six tiles, validated (not a letterboxed blank page).
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
- [x] **Walk (cloud):** same from a laptop over Cloudflare Tunnel
      (`compose.cloudflare.yml`) or Tailscale. No Cast. Agents have
      no inbound ports. Login is still Gantree’s door on the host.

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
- [x] **`source` always on `turn perf`.** Contract set: `user` / `cron` /
      `watch` / `reaction`. Anything else (or empty, on old images) is
      spend **unknown**. Spark / examples wake as `cron`. Cron/watch may
      omit `user_id`. User/reaction with a channel id must not.
- [x] **Native OpenAI-compat `usage` on the same line** when Completer
      had it: `prompt_tokens`, `completion_tokens`, `total_tokens`,
      `usage_rounds`. Details when the provider sent them:
      `cached_tokens`, `cache_write_tokens`, `reasoning_tokens`,
      audio / prediction counts, `service_tier`. `prompt_est_tokens` /
      `gen_est_tokens` stay the chars/4 fallback. Streaming uses
      `stream_options.include_usage` (no extra HTTP).
- [x] **`model` + `finish_reason`** (+ `duration_ms` alias of `total_ms`)
      on that line. See
      [repos/ai-gantry/docs/gantree-contract.md](repos/ai-gantry/docs/gantree-contract.md)
      slog section.

The harness never learns instance names. Gantree never sits in the
token path of a chat turn. Consume slog / `status` the crane already
emits. Do not ask the harness to grow dashboard hooks.

**Here (parse, don’t re-ask the harness):** Mini cranes emit the new
keys only after a pin/recreate onto an image that has this slog.
Gantree now parses native `usage`, `model`, `finish_reason`, and
`total_ms` off `turn perf` (spend + charts). Recreate Mini cranes or
the new keys never show up. `unknown` remains for invalid/legacy
`source` only.

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
   box. No teams, no orgs, no SSO. Three named roles (`admin` / `user`
   on one crane / `readonly`) — not twelve-role RBAC.
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
| Operators | Add / remove / roles (`admin` sees every crane; `user` / `readonly` one). Cannot delete the last operator or last admin. |
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

**Delivered.** M0–M4 walks are done on the live Mini (door, operators,
board nags, sqlite graph memory, audit). Friends reach the same host
through **Cloudflare Tunnel** (`compose.cloudflare.yml`) — login still
lives on the Node process; agents still have no inbound ports. That is
the v2 cloud story. Portal (M5) is a *Workers skin*, not the tunnel;
it stays with the phone track and does not block v3.

Leftover v1 walks (live Google OAuth, recreate-while-Telegram-answers,
stranger hello) stay open as you go — they are still how a stranger
knows v1 is real. Pitch shots: see **Now**.

Home compose publishes `:80` on the LAN *behind* login. First boot is
`/setup`. Cloud VM still `GANTREE_LISTEN=127.0.0.1` plus the tunnel.

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
      `GANTREE_LISTEN=127.0.0.1`. Screenshots: `assets/docs/setup.png`,
      `assets/docs/login.png` (README + install + headless).
- [x] **Walk:** compose on the Mini, LAN IP, logged-out browser
      cannot read logs or `.env`. Setup one operator. Login. Board
      works. Restart. Must log in again.

---

## v2 Milestone 1 — a handful of operators

You and a partner. Not a user-admin product.

- [x] Profile (name, photo, passphrase) and Settings (operators, roles)
      are separate pages. Cog in the header. Confirm-scary, like token
      push. Hashes never round-trip.
- [x] Cannot delete the last operator. Cannot remove yourself if
      you are the last.
- [x] Three roles: `admin` (everything), `user` / `readonly` (assigned
      cranes; readonly look-only). Only admin sees every crane.
      Settings (cog) assigns them. Last admin cannot be demoted or deleted.
- [x] **Walk:** add a partner. They log in on a phone. Same yard.
      Remove them. Their next request is 401. Add a user on Kit; they
      see only Kit’s card. Add a readonly on Kit; they see Kit and
      cannot recreate. They cannot open another crane.

---

## v2 Milestone 2 — nags

The board tells you before 11pm. Still pull-only.

- [x] Yard home: per-card badge for skipped MCP, needs-auth, dead
      process — without opening Tools.
- [x] Token-expiry / oauth-file-missing uses doctor + files (same
      signals as today, surfaced).
- [x] Consume richer `gantry status` JSON when present (parse, do not regex
      `"ok":false`). File-based hints remain until the Hub pin ships it.
- [x] **Walk:** yank `google-oauth.json` (or ungrant). Board nags
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
- [x] **Walk:** use Kit for a day, `docker compose restart`, open
      Kit: last day’s turns are still there. `gantree.toml` still
      lists the slugs.

---

## v2 Milestone 4 — who did that

Mutations have an operator, not just a timestamp.

- [x] Audit log in the same sqlite: grant / revoke, recreate, env
      save, operator edits, setup. Actor = session operator.
- [x] Small UI: last N on the crane page and a yard events
      strip. Not a SIEM.
- [x] **Walk:** partner recreates Kit. You see their name on that
      event. Logged-out, the audit API is 401.

---

## v2 Milestone 5 — portal (last)

Second skin. Same operators story. Socket stays on the host.
**Not v3.** Phone layout / mobile experience is a parallel track.
This milestone is the Workers skin *if* that track still wants a
remote `app/` — it is not the v3 product and it does not gate M0
below.

- [ ] Host exposes a **machine** token (file / env, not an
      operator password) for the portal. Browser cookies never
      authenticate cross-origin to `docker.sock`.
- [ ] Same `app/` on Vinext Workers (or the smallest CF skin that
      is still this repo). It calls the host. It does not import
      dockerode.
- [ ] Login lives at the portal when that is the public-ish URL.
      Host can bind loopback only.
- [x] Cloud docs: tunnel *or* portal, not “open 3000 and hope
      login is enough.” (`compose.cloudflare.yml` is the share path.)
- [ ] **Walk:** laptop → Worker → Mini on `127.0.0.1`. Board,
      login, grant, recreate. Agents still have no inbound ports.
      Kill the Worker: host UI still works on loopback.

---

## v3 looks like (the end)

v1 is a yard you can *see*. v2 is a yard you can *share* (a door on
the LAN). v3 is a yard you **live in** — you can tune it and read a
week without opening sqlite or grepping slog. Chat still stays
Telegram. Agents still open zero inbound ports. Still your box.

Mobile / phone layout is **not this version** (parallel track).
The portal is not this version. Prometheus is not this version.

**Home.** Open the Mini. The cog is no longer only people: retention,
timezone, default image pin, an optional $/1M so spend can show a
household number (still an estimate). Kit’s graphs include disk, net,
and how long a turn actually took — empty if Docker / slog didn’t
say, never invented. Bob on Profile is a *name* on the spend bar,
and “put me on Kit’s allowlist” writes `TELEGRAM_ALLOWED_USERS`. A
tryout you don’t want: retire it (container + directory + toml row).
A Thursday you do want: restore `gantry.db` + `SELF.md`, never `.env`.

**Cloud.** Same app. Still loopback + tunnel. No billing API. No
Grafana sidecar.

**Operator loop that must work end-to-end**

1. Admin opens Settings. Not only operators: keep 30d of turns, set
   the yard timezone, paste a Flash rate if you want a $ column.
2. Partner saves their Telegram id on Profile. Spend says their
   *name*. One confirm-scary writes that id onto Kit’s allowlist.
3. Kit dashboard: CPU / RAM plus net, data-dir bytes, turn duration,
   tool skips. Missing slog fields stay blank.
4. Overlay Kit vs tryout tokens for the week. Kit is still Kit’s
   page — the compare is a fold, not a mixed fleet dump.
5. Backup. Restore last Thursday’s memory. Recreate. Telegram still
   answers. `.env` did not come back from the stamp.
6. Retire tryout: container gone, directory gone, row gone from
   `gantree.toml`. Confirm-scary. Kit is untouched.

If that loop is “we added Grafana and a second inventory,” we missed.
The product is a household ops surface that still **pulls**.

---

## v3 fit gates

v1 and v2 gates still hold. Deltas:

1. **Inventory stays files.** Yard prefs live in `gantree.toml`
   (a `[observe]` / `[yard]` table: retain days, timezone, default
   pin, optional token rate). Do not mint a settings table that
   duplicates slugs. Operators stay sqlite — people are not
   inventory.
2. **Chat ids write `.env`, they don’t merge brains.** Profile
   channels label spend. Pushing an id onto a crane is an explicit
   edit of *that* crane’s allowlist. Isolation stays the feature.
3. **Pull, don’t punch.** Net / blkio from the `docker stats` blob
   we already fetch (CPU/RAM today; the rest is sitting there). Disk
   is `du` on `data_dir`. Duration / tool counts from JSON slog when
   present. If a field isn’t there, the chart stays empty and we ask
   `ai-gantry` for a stable key — we do not sit in the turn.
4. **Estimates stay estimates.** A pasted $/1M is a calculator on
   chars/4. Not a GCP invoice. No provider usage API in v3.
5. **Three roles still.** Yard prefs are admin. `user` mutates their
   assigned cranes (allowlist push, backup). Retire is admin.
   `readonly` looks.
6. **Restore is memory, not a clone.** Stamp = `gantry.db` +
   `SELF.md` (+ avatar if we already copy it). Never `.env`, never
   `mcp.toml`, never oauth files.
7. **Retire a tryout = delete that directory.** Confirm-scary. Toml
   row goes with it. Not a soft-delete product.
8. **Meh yard, tight crane.** The operator can wait 200ms for `du`.
   The human on Telegram cannot wait for a scrape. If a dashboard
   want would make `ai-gantry` slower, the want is wrong.
9. **Not chat. Not mobile. Not a portal. Not Prometheus.**

---

## v3 ships

| Surface | What “done” means |
| --- | --- |
| Yard settings | Cog grows a pane: retain days, timezone, default Hub pin, optional $/1M, session idle. Admin. Written to toml (idle may stay code-default if toml is the wrong home — pick one, don’t split). |
| People → cranes | Profile chat ids label spend (`user_id` → display name). Confirm-scary “add to this crane’s allowlist” writes `.env` and nags recreate. |
| More series | Host: net I/O, blkio, data-dir bytes. Turns: duration, outcome, tool skip/error **when slog has them**. Empty otherwise. |
| Compare | Overlay a handful of cranes on the board (tokens / CPU). Still pull. Still one page per instance for logs. |
| Backup loop | List `backups/`. Restore `gantry.db` + `SELF.md`. Prune old stamps. Recreate after restore. |
| Retire | Admin deletes a tryout: stop, rm container, rm directory, drop toml row. Kit survives. |
| Audit | Filter last N by kind / slug / who. jsonl download. Still not a SIEM. |

**Not v3:** Workers portal, phone layout, Prometheus, billed
invoices, SSO, systemd, a `gantree` CLI, pairing chat through the
console, a shared family brain.

v3 *ships* when the household loop (settings → named spend → richer
graphs → backup/restore → retire) is a stranger walk. Compare and
audit-filter can land in the same walk; they are not a second
product.

---

## v3 now

v2 host-yard loop is delivered. Mobile is someone else. **M0 is
still the settings cog** (people only). A first slice of M1/M2/M4
is in: Profile chat ids label spend, Telegram can queue an
operator id onto a crane allowlist, Docker net/blkio and slog
`duration_ms` chart when present, turns-by-source when slog has
`source`, last-turn age + recovery spark on the board, data-dir
`du` (chart + fat-card number), the event strip filters by kind
and downloads jsonl. Still missing: yard `[observe]` prefs,
compare overlay, backup list/restore, retire.

Push into `ai-gantry` only when every consumer benefits (same rule
as v1): stable `turn perf` fields for duration and tool
counts if they are not already there. Parse here. Do not invent a
dashboard hook.

---

## v3 Milestone 0 — the cog is a yard

First useful v3 product: Settings is not only who is on the box.
Admin can tune the yard without editing toml by hand.

- [ ] `gantree.toml` grows a `[observe]` (or `[yard]`) table: retain
      days (host vs turns), timezone for charts, default image pin
      for *new* cranes. Optional token rate ($/1M, prompt + gen)
      used only as a spend calculator. No secrets in that table.
- [ ] Settings page: operators stay the first pane; **Yard** is the
      second. Admin-only writes. Confirm-scary on retain-days
      (prunes sqlite). `user` / `readonly` can read the rates so
      spend $ matches what they see.
- [ ] Session idle / absolute stay documented. Expose them only if
      we can do it without a second source of truth (toml *or*
      env — not both).
- [ ] Default pin is what the build wizard offers next. Existing
      cranes keep their compose tag until you pin/recreate.
- [ ] Tests: non-admin PUT is 403; retain prune respects the new
      cap; missing table = today’s 7d / 32d defaults.
- [ ] **Walk:** admin sets timezone + 30d turns + a Flash rate.
      Refresh Kit: axis labels in that zone, spend shows an est. $
      column, host samples still cap. Bounce `npm start`. Prefs
      survived because they are in `gantree.toml`.

---

## v3 Milestone 1 — names on the cranes

Profile chat ids stop being a label that does nothing.

- [x] Spend `by user` shows operator display name when the slog
      `user_id` matches a profile channel id. Unknown ids stay
      raw (don’t invent a person).
- [x] On a crane’s Telegram (or channel) panel: “add this
      operator’s id to the allowlist” — queues the numeric id;
      Save allowlist still writes `TELEGRAM_ALLOWED_USERS` and
      nags recreate. Never a silent merge across cranes.
- [x] Suggest ids seen in slog that are not on the allowlist yet.
      Suggest ≠ write.
- [x] `readonly` can see names. Only `user` / admin on that crane
      can push an id.
- [ ] **Walk:** partner saves a Telegram id on Profile. Kit spend
      says their name, not `123456`. Admin adds them to Kit’s
      allowlist. Recreate. They can talk to Kit. Tryout’s
      allowlist did not change.

---

## v3 Milestone 2 — more of what we already pull

Richer graphs. Same pull. No new harness port.

**Host** (Docker stats + disk — Mini can wait)

- [x] Parse net I/O + blkio from the stats blob `cpuMemFromStats`
      already receives. Sample into sqlite next to CPU/RAM.
      Missing cgroup fields stay empty.
- [x] Data-dir bytes (`du` on `data_dir`, periodic, not per-request
      on the board). Chart + a number on the card when it’s fat.
- [ ] Retain respects M0. Don’t keep 30d of 1Hz CPU on a Mini by
      accident — host cadence stays sparse.

**Turns** (slog — parse, don’t fake)

- [x] Consume duration when `turn perf` (or a neighbor line) has
      `duration_ms` / `elapsed_ms`. Outcome already has a column.
      Tool skip-error still needs a stable harness field if absent.
- [x] Completer vs chat vs cron as a series when `source` is on
      the line (spend already slices it; the chart doesn’t).
- [x] Board: last-turn age and a quiet recovery spark. Empty
      until a chat. Don’t invent a line.

- [ ] **Walk:** talk to Kit for an hour. Dashboard shows net +
      data-dir size. If the image emits duration, a latency chart
      fills; if not, it stays honest-empty. `docker stats` is
      still the host source — no `/metrics` on the crane.

---

## v3 Milestone 3 — backup is a loop

Backup is already a button (`gantry.db` + `SELF.md`). v3 is list,
restore, prune, and a way to kill a tryout.

- [ ] List stamps under `backups/` (or `backups/<slug>/` if we
      already nest — don’t reshape without a reason).
- [ ] Restore: copy `gantry.db` + `SELF.md` back, then recreate.
      Refuse `.env` / `mcp.toml` / oauth files even if a curious
      stamp contains them.
- [ ] Prune: keep last N or last retain-days, admin. Confirm-scary.
- [ ] **Retire** a crane (admin): stop, remove container, delete
      that directory, drop the `gantree.toml` row. Confirm-scary
      (type the slug). Kit is another directory — it survives.
      Audit: who retired what.
- [ ] **Walk:** backup Kit. Chat. Restore Thursday’s stamp.
      Recreate. Kit remembers Thursday, not the chat after.
      Token in `.env` is still the live one. Retire tryout: gone
      from the board and from disk. Kit still answers.

---

## v3 Milestone 4 — compare + ask the audit

The board already ranks spend. v3 is overlay and a filter, not a
metrics company.

- [x] Kind filter on the event strip (`?kind=`). jsonl download for
      the same query. Not a full audit page yet: no who-filter, not
      a SIEM.
- [ ] Compare fold on the yard home: pick 2–3 cranes, overlay
      tokens (and CPU if we have samples). Logs stay per-instance.
- [ ] Audit page extras: who, last N, jsonl download for the same
      query. Still not a SIEM.
- [ ] **Walk:** overlay Kit vs tryout for 7d — Kit burned more.
      Filter events to “recreate” + partner’s name. Export jsonl.
      Logged-out, those APIs are 401.

---

## vDashboarding looks like (the end)

The yard is already a dashboard: host, spend, cards, events. A second
**dashboard** page is not Grafana and not a replacement yard. It is a
**saved watch** — one question the opinionated board will not answer
without hopping (yard → crane → host → logs).

If we cannot name three of those questions, we do not build a widget
supermarket.

**Home.** `/dashboards` lists *your* watches (per operator, sqlite, not
`localStorage`). Open one: one context bar (window, tags, crane set)
and a grid of tiles you arranged. Click a tile, leave — recoveries go
to that crane, host CPU to `/host`, an error line to logs. The watch
is an index, not a second home for every editor.

**Typical watches (the job, not the mechanism)**

- *Are my cranes dying?* state, nags, recoveries, last error — not the
  token chart
- *Who is burning money?* spend by crane / source / window, native
  tokens when slog has them, next to turns
- *Is the Mini the bottleneck?* host CPU/RAM/net next to the noisy
  cranes
- *Did that MCP or tag change land?* skipped MCP, grant events, one
  tag filter

A “window into all the metrics” is **one slice of everything** (this
tag, last 24h, health + spend) — not a wall of every Docker stat.

**What we do not do**

- Replace the yard with an empty board (new operators land in nothing)
- Per-tile filter bars (dashboard-level context, or the product goes
  feral)
- A scrape, a `/metrics` port, or extra Completer I/O so a chart looks
  busy (fit gate 10 still wins)
- Invent numbers. Empty tile if slog / Docker did not say

---

## vDashboarding fit gates

v1–v3 gates still hold. Deltas:

1. **Catalog first** A tile is a named object (id,
   grain, unit, which filters it honors, which viz it can be) — not
   “embed this React tree.” Drag-and-drop without a catalog is interior
   decoration.
2. **One context bar.** Time window, tags, crane set apply to every
   tile. A tile that cannot honor the filter shows n/a, it does not
   lie.
3. **Grain is a type.** Yard / host / crane / operator. Do not drop
   host CPU into a per-crane row.
4. **Click-through.** Tiles are windows. Detail stays on the page
   that already owns it.
5. **Yard stays canonical.** Saved watches are personal or
   situational. The board is still the ops home.
6. **Pull, don’t punch.** Same slog + `docker stats` + files. Native
   usage is copied off the Completer response the harness already
   has (see **Push into ai-gantry**). No provider billing API here —
   that stays Later.
7. **Estimates stay labeled estimates.** Native Completer `usage` is
   what we chart when `turn perf` had it. chars/4 and a pasted $/1M
   remain the fallback calculator. `unknown` on spend is a hole
   (legacy/invalid `source`), not a personality.
8. **Not Prometheus. Not Grafana. Not a metric company.**

---

## vDashboarding ships

| Surface | What “done” means |
| --- | --- |
| Catalog | ~15 named tiles from what we already compute (and what slog grows). Missing fields = empty, not fake. |
| Attention | One curated surface: dead, nags, recoveries, last error. Tag + window filters. Higher leverage than a builder if that is all anyone pins. |
| Spend honesty | `unknown` is visible and counted. Native tokens when `turn perf` has OpenAI-compat `usage`; chars/4 labeled estimate otherwise. Unattributed user turns called out. |
| `/dashboards` | List of saved watches. Open, rename, delete. Per operator. |
| Same auto-fill grid as the yard. Drag from catalog. Dashboard-level filters. Click-through. |
| Persist | sqlite, not the browser. Survives a new laptop. |

**Not this track:** billed GCP invoices, scraping every cgroup, a
public widget store, replacing the yard.

vDashboarding *ships* when a stranger can save “home-tag, 24h, health
+ spend”, reopen it tomorrow, and click an error into that crane’s
log. The supermarket without three named watches is a miss.

---

## vDashboarding now

Not started as a catalog/builder. v3 still owns richer series on the
**existing** pages (net, duration, source mix). This track starts with
a **catalog of holes**, then one attention surface, then a builder —
in that order. Native slog parse for spend is already on those pages.

Harness slog is **done** (contract + `gantree_todo.md`). Recreate Mini
cranes onto the pinned image so they emit it. Gantree parse of native
`usage` / `model` / `finish_reason` is **in**: spend and charts use
Completer tokens when `turn perf` has them, chars/4 otherwise.
`unknown` is a missing/invalid `source` (old image, or a string
outside `user|cron|watch|reaction`). `unknown` on a *new* image is a
bug.

---

## vDashboarding Milestone 0 — the catalog

Name the tiles.

First catalog (small on purpose). If a number is not here, it is a
crane-page detail, not a dashboard metric:

| Bucket | Tiles |
| --- | --- |
| Health | state, nags, recoveries, last error, last-turn age |
| Spend | est. tokens (chars/4), native tokens when slog has them, turns, by source, by user, pace, **unknown/unattributed** |
| Host | CPU / RAM / net share, fat data dirs |
| MCP | published vs skipped |
| Door | events by kind, grants, logins (admin) |
| Logs | tail filtered by crane + error level |

Each entry: id, grain, unit, filters it honors, viz it can be
(number / spark / table / log tail). Logs are not a sparkline.

- [ ] Write the catalog as data Gantree can import (one module), not
      a wiki. Tests: every live ring/rollup we already have maps to a
      tile or is explicitly “not a tile.”
- [ ] List **holes** next to the tile: empty because we don’t parse
      it yet vs empty because the harness never slog’d it vs empty
      because Docker didn’t send it. That list is the push into
      `ai-gantry` / v3 parse work, not a new sampler.
- [ ] **Walk:** open the catalog in a test. `spend.estTokens` and
      `host.cpu` exist. `spend.nativeTokens` exists (empty until slog
      has `prompt_tokens`). `spend.unknown` exists and is the
      unlabeled-source count.

---

## vDashboarding Milestone 1 — fill the holes

Catalog without data is a menu. This milestone is **parse** (slog is
already on the contract). Recreate Mini cranes first or the new keys
will not show up.

**Spend / turns (parse the contract)**

- [x] Consume native `prompt_tokens` / `completion_tokens` /
      `total_tokens` / `usage_rounds` / `cached_tokens` /
      `cache_write_tokens` / `reasoning_tokens` (and audio / prediction
      counts) when `turn perf` has them. Chart next to chars/4; label
      which is which. Empty if absent.
- [x] Parse `model` / `finish_reason` / `duration_ms` when present.
- [x] Spend mix: `unknown` is a first-class slice with a count, not
      a grey leftover. Nag when the bucket is most of the window —
      old image, or a `source` string outside
      `user|cron|watch|reaction`.
- [x] Unattributed user turns (`user_id` missing on a `user` /
      `reaction` turn) called out the same way. Profile names already
      map ids we *do* have (v3 M1).

**Health / logs (already on pages, not tiles yet)**

- [ ] Last error / last nag / last-turn age as catalog fields (crane
      card already shows pieces).
- [ ] Error log tail as a tile source (filter + last N), not a second
      log product.

**Host / MCP**

- [ ] Point catalog tiles at v3 series we already sample (net, disk,
      published vs skipped). No new Docker poller.

- [ ] **Walk:** pin/recreate Kit. Talk to it. Spend shows native
      tokens when Completer sent `usage`; otherwise labeled estimate.
      A turn with `source` outside the contract set (or a pre-pin
      image with empty `source`) increments `unknown` and the yard
      says so.

---

## vDashboarding Milestone 2 — one attention surface

Before drag-and-drop: one curated page that is the watch everyone
would pin anyway.

- [ ] `/attention` (or a yard fold): dead + nags + recoveries + last
      error, tag filter, spend window. Same pull.
- [ ] Click-through to the crane. Empty when the yard is quiet.
- [ ] **Walk:** stop Kit. Attention shows dead. Tag `home`. Spend
      unknown still visible if the slog is mute on `source`.

If this page is enough for months, **stop**. The builder waits until
someone wants a second watch this page cannot be.

---

## vDashboarding Milestone 3 — saved watches

Only after M0–M2 have named tiles and one real watch.

- [ ] `/dashboards` list. Create / rename / delete. Per operator
      (sqlite).
- [ ] auto-fill grid (same as the yard). Drag from catalog.
      One context bar (window, tags, cranes). Persist layout.
- [ ] Click-through. Pin-one-as-home is later, and must not hide the
      yard from operators who did not pin.
- [ ] **Walk:** save “home-tag, 24h, health + spend.” Sign out, other
      browser, same operator: the watch is there. A `readonly`
      operator cannot mutate yours.

---

## Later (after v3)

- Operator saved watches / drag-and-drop tiles — **vDashboarding**
  (above). Not Prometheus. Catalog + attention page before a dashboard.
- systemd yards, not only compose
- A `gantree` CLI (only if the UI + `npm` scripts are genuinely not
  enough — still TypeScript, not a Go Makefile)
- Prometheus / long-retention metrics store
- GCP / provider usage pull (billed $). v1–v3 spend is chars/4
  (plus an optional pasted rate) — good for “who burned the
  budget”, not an invoice.
- SSO / OIDC / “log in with GitHub” — not needed while operators
  are a handful of hashed passphrases on disk
- Workers portal — only if the mobile track still wants a remote
  `app/` (v2 M5)
- Operator writes on `/boards` (create / pin / check in) — agents stay
  the mouth; the page is read-only

## Not the product

- Hosted Gantree SaaS / spinning agents for paying customers
- Cloud Run / Lambda / App Runner
- Kubernetes
- Shared family brain
- Pairing the agent through the console
- Multi-tenant orgs, invite links, billing
- Anything that makes `ai-gantry` slower so this UI looks nicer
