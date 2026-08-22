# gantree — todo

Work backwards from v1. This file is the build script: what “done” looks
like, then the milestones in the order we walk them. Pitch lives in
[README.md](README.md). Stack and host I/O:
[docs/architecture.md](docs/architecture.md). Harness-side note:
[repos/ai-gantry/docs/gantree.md](repos/ai-gantry/docs/gantree.md).

KISS / MLP: just enough to run the yard. Vinext + TypeScript only.
`npm start` is the process. No `gantree` CLI and no second language
until a real gap forces it.

Status: **now** · **next** · **later** · **not v1**
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

**Not v1:** `gantree` CLI / Go binary, Workers portal, systemd yards,
token-expiry nags, hosted SaaS, Kubernetes, shared family brain,
agent chat in the console.

---

## Now

Docker is live. Built cranes `kit` + `tryout` (`shotah/ai-gantry:0.1.66` pin,
stdio) via the UI API. Board, doctor, structured logs, stats, MCP/uptime
charts, paste-code auth, recreate wait-for-doctor. Open
`http://127.0.0.1:3000`.

Still needs a human: live Google OAuth, recreate-while-Telegram-answers,
stranger walks, a board screenshot. Harness `gantry status` is still a
heartbeat — MCP skip charts are file-based until the harness grows a richer
doctor.

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
- [x] MCP: published vs skipped over time (from doctor / status)
- [x] Restarts / uptime chart (inspect has startedAt; no chart yet)
- [x] Board sparklines optional
- [x] Missing slog fields stay empty — don’t fake a line

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
- [ ] Harness ask if `gantry status` / `doctor` is too thin — still open
- [x] **Walk:** kit doctor: process running, PERSONA.md, slim grant listed.

---

## Milestone 5 — run

Start / stop / recreate. Env change **recreates** (restart keeps ghost
allowlists).

- [x] `lib/yard` start / stop; recreate = remove + create with current env/files
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
- [ ] **Walk (home):** stranger clones this repo, `npm start`, builds
      one crane in the UI, grants search, chats on Telegram.
- [ ] **Walk (cloud):** same from a laptop over Tailscale. No Cast.
      Agents have no inbound ports.

---

## Milestone 11 — hello path

A stranger does either story without reading anyone’s private git.

- [x] Root README hello: clone → `npm start` → attach or build a crane
- [x] No `.env` or `data/` copied from a private checkout
- [x] Pin `shotah/ai-gantry` by Hub tag; nested `repos/ai-gantry` is
      **dev only**
- [ ] Screenshot / short clip of the board + one agent dashboard
      (graphs + visual log) + Tools
- [ ] **Walk:** the two “done looks like” stories above, from a clean
      machine.

---

## Push into ai-gantry (when every consumer benefits)

Do these in the harness repo, not here. Gantree consumes them.

- [ ] Richer `gantry status` / `doctor`: channel, each MCP connected vs
      skipped, auth yes/no, persona files present
- [ ] Refuse “healthy” when the manifest is all skipped
- [ ] Tool errors a model *and* a UI can tell apart: no binary vs no key
      vs no OAuth
- [ ] Stable JSON slog fields for turns / tokens / recoveries so the
      dashboard graphs are not regex soup
- [ ] Stable file/env contract docs the console can write against

The harness never learns instance names. Gantree never sits in the
token path of a chat turn. Consume slog / `status` the crane already
emits. Do not ask the harness to grow dashboard hooks.

---

## Later (not the walk)

- Vinext-on-Workers as a portal in front of one or more host agents
- systemd yards, not only compose
- A `gantree` CLI (only if the UI + `npm` scripts are genuinely not
  enough — still TypeScript, not a Go binary)
- Token-expiry / skipped-MCP nags
- sqlite event log (v1 inventory stays `gantree.toml`; v1 graphs are
  an in-memory ring buffer)
- Prometheus / long-retention metrics store
- Cross-agent compare view (v1 is one page per instance)

## Not the product

- Hosted Gantree SaaS / spinning agents for paying customers
- Cloud Run / Lambda / App Runner
- Kubernetes
- Shared family brain
- Pairing the agent through the console
- Anything that makes `ai-gantry` slower so this UI looks nicer
