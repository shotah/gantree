# Architecture

Gantree is the **operator plane** for
[ai-gantry](https://github.com/shotah/ai-gantry): a shipping yard, not the
chat. The crane is the product — why the harness is worth operating lives
in the [root readme](../README.md). What you click on the board:
[console.md](console.md). People (login, profile, settings):
[operators.md](operators.md). One person across yard, pendant, and crane:
[access.md](access.md). Switch a running crane’s mouth:
[channel_migration_doc.md](channel_migration_doc.md). This page is how
the yard is put together — stack, host I/O, and the choices that stay
true as the board grows.

Harness-side design note (nested checkout, **dev only**):
[repos/ai-gantry/docs/gantree.md](../repos/ai-gantry/docs/gantree.md).

Open items live in the repo, not on the site:
[docs/todo.md](https://github.com/shotah/gantree/blob/main/docs/todo.md).

---

## Operator plane

The household picture (three repos, one file contract) lives in the
[root readme](../README.md#three-repos-one-household). This page is the
yard’s stack.

```text
[ browser ]                                 [ phone ]
     |                                            |
     |  localhost | Tailscale | Tunnel | nginx    |  Google
     v                                            v
[ gantree — Vinext on Node, on the Docker host ]  [ gantry-pendant Worker ]
     |  Docker API + files on disk                      ^
     v                                                  | dials bearer + allow
[ gantry ] [ gantry ] [ gantry ]  ----------------------+
     |
     |  optional: Telegram / Discord / Slack
```

Agents open **zero** inbound ports. Only this UI is reachable, and only
through a path you chose. Bind `127.0.0.1` by default. Never a public
load balancer.

Two install stories, one runtime: Linux + Docker + this process on that
host. Home Mini vs cloud VM: [install.md](install.md).

---

## Why a process on the Docker host — and why Vinext

We need a server that can **see Docker** from day one. Even the first
useful screen is “is Kit up, and what did it just log?” That is
`docker inspect` + `docker logs`, not a static site.

So we start in a framework. [Vinext](https://vinext.dev/) is the pick:
write `app/` like Next, run `vinext`, TypeScript the whole way. The
harness stays Go. The dashboard is not Go.

The thing that would be wrong is putting that framework **where Docker
is not**. Vinext’s happy path is Cloudflare Workers. Workers cannot
open `docker.sock`, tail a container, or rewrite `mcp.toml` on the Mini.
The console is therefore **Vinext targeting Node** (`--platform=node` /
standalone), running **on the Docker host** — Mini or a small VM.

| Layer | Where it lives | Why |
| --- | --- | --- |
| UI (`app/`) | Vinext / React | Board, build crane, Tools, graphs + logs |
| Host I/O (`lib/yard`) | Node route handlers | dockerode, compose, files |
| Harness | `shotah/ai-gantry` container | Chat, memory, MCP children |

Docker, compose, and `tools-fetch` stay in **route handlers** (or
`lib/yard`), never in a React Server Component. Vinext’s native-addon
footgun is real; this is how we don’t step on it.

Later, the *same* `app/` can sit on Workers as a portal that calls this
host. That is a second skin, not this runtime. Tailscale or a Cloudflare
Tunnel in front of the Node console is how you reach a cloud VM today.

**Avoid:** Next-on-Vercel as the host. A SPA plus a mystery API.
Harness + console in one Distroless image.

No second language, no `gantree` CLI until a real gap forces it:

```bash
npm start          # vinext start — bind 127.0.0.1
npm run dev        # vinext dev
```

---

## How gantree sees a gantry

The crane does not grow a `/metrics` port. Gantree **pulls**.

| What you want | Where it comes from |
| --- | --- |
| Alive, image, restart | Docker inspect / compose |
| Visual logs (per instance) | `docker logs` stream, structured in the UI |
| CPU / RAM / net / blkio | sampled `docker stats` / cgroup (ring + yard sqlite). Host card rolls containers up by role (agents / dashboard / other). |
| Data-dir size | `du` of the crane’s `data/` on the host |
| Turn / token graphs | JSON slog `turn perf` (`prompt_est_tokens`, `gen_est_tokens`, `iterations`, `user_id`, native `usage` when Completer sent it, `model` / `finish_reason` / `duration_ms` when present) — same sqlite so a bounce keeps this billing month (local 1st) |
| Published vs skipped MCP | `mcp.toml` + `gantry status` JSON (`mcp.servers[].reason`: `no_binary` / `no_key` / `no_oauth`) |
| Persona, secrets | `PERSONA.md`, `avatar.jpg`, `.env`, `data/` on disk |
| Pendant mouth (default) | `.env` (`CHANNEL=pendant`, mailbox URL, bearer present?, `PENDANT_ALLOWED_USERS`). Gantree writes the list and pushes Worker secrets (Google, session, `CRANE_BEARERS`) from Settings. The Worker never sees the yard cookie. |
| Telegram bot | Bot API `getMe` / `setMy*` after a token exists. Allowlist is `.env`. Never `getUpdates`. |

Files remain the source of truth. The UI is an editor of those files,
not a second inventory. Secrets never go in git. Console-in-Docker must
see those files at the inventory path — uncomment the same-path volume in
`compose.yml` when attaching absolute host dirs ([headless.md](headless.md#8-console-in-docker)).
Metrics and container env still work without it; persona and `mcp.toml` do not.

Inventory is `gantree.toml` (no secrets). One mutation path: the UI
calls `lib/yard`. Never dockerode from a React Server Component.

Yard memory (`gantree.db`) is **sessions, operators, graph samples,
audit** — not a second inventory of cranes. Operators are independent of
each crane’s `gantry.db`. Restore a crane’s memory from a stamp; do not
clone Kit into Ada.

Recreate / pin **keep** the crane’s host `user` (Vinext uid:gid, never
image `65532`), `network_mode`, and extra binds. Dropping uid is how
`session store open failed` happens: Distroless cannot write a
`gantry.db` owned by your login. Env change **recreates**; restart keeps
a ghost allowlist.

---

## Choices that stay true

If a task fails one of these, it is later, or it belongs in `ai-gantry`.

1. **Files are truth.** The UI edits `gantree.toml`, `mcp.toml`, `.env`,
   persona files. Crane inventory is toml, not a second DB.
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
   Workers is a later portal, not this console.
6. **Bind localhost.** `127.0.0.1` by default. Tailscale / Tunnel if
   you leave the box. Never a public load balancer.
7. **Isolation.** One human, one bot, one directory, one `data/`.
   Delete a tryout = delete that directory. Pushing a person onto Kit
   does not touch Ada’s crane.
8. **Not chat.** The pendant is the default mouth; Telegram, Discord, and
    Slack still work. No pairing the agent through the console. The yard
    never sits in a chat turn.
9. **Import over write.** dockerode, compose, Vinext. Don’t invent a
   Docker client.
10. **Meh yard, tight crane.** Gantree is JS in a browser. That stack
    will never be as fast as the Go harness — and that is fine. The
    operator can wait 200ms for a chart. The human on the phone cannot
    wait for a serial tool loop. Never sit in the token path. Never
    add a listen port, a scrape, or a hook that taxes parallel tool
    calls, Completer rounds, or RSS. If a dashboard want would make
    `ai-gantry` slower, the want is wrong. Parse what the harness
    already logs. Do not invent instrumentation for prettier graphs.
11. **Every route is a door.** Setup + login + session on every API
    and log SSE. Admin sees every crane; `user` / `readonly` their
    assigned. What the door checks: [security.md](security.md).
12. **Yard door stays passphrase.** Google is a field on the operator
    and a login on the pendant Worker. Not a yard session. The Mini
    must open when `accounts.google.com` does not.
13. **The crane’s `.env` is the human allowlist.** Gantree writes it.
    The crane reads it at boot. The Worker enforces what the crane
    published. No Cloudflare API token on the Mini. Details:
    [access.md](access.md).
14. **Estimates stay estimates.** Spend is slog tokens (native
    `usage` when Completer sent it, else chars/4) plus an optional
    pasted $/1M. Not a GCP invoice. `unknown` is a first-class slice
    when `source` is missing or outside `user|cron|watch|reaction`.

---

## What the yard is today

One runtime: Linux + Docker + Vinext on **Node on the Docker host**.
Hub image `shotah/gantree` with `docker.sock`. Two install stories
(home Mini vs cloud VM), same console.

| Surface | What it is |
| --- | --- |
| Yard home | Cards: name, alive, model, channel, published vs skipped MCP, last error, last turn, spend. Nags for skipped MCP / needs-auth. |
| Agent dashboard | Per instance: metric graphs + visual logs. Kit’s page is only Kit. Folds for Tools, persona, secrets, pendant, Telegram, run. |
| Build crane | Wizard: home vs cloud, slug, persona seed, model, channel (pendant default) + operator checkboxes, `slim` / `life` / `life-cast` |
| Tools | Catalog + custom binary; toggle writes `[[server]]`, `tools-fetch`, recreate; “needs auth” is a button |
| Persona + secrets | Markdown editor; `.env` form; token push explicit and scary; never copy `data/` by default |
| Run | Start / stop / recreate; live visual log; image pin; backup button (`gantry.db` + `SELF.md`); destroy (optional files) |
| Door | `/setup` then `/login`. Operators in yard sqlite. Profile: email, Telegram, Google `sub`. Audit of who mutated what. |
| Yard pane | Retain (host vs turns), timezone, default pin, optional $/1M. Admin writes; others can read the rates. |
| Host page | `gantree.toml` + yard sqlite. CPU/RAM/net rollup by role. |
| Spend | Names from profile chat ids and Google `sub`. Suggest storing a slog `user_id` on the matching operator. Event strip: kind filter + jsonl. |
| Process | `npm start` / `vinext start` (or compose). Bind `127.0.0.1`. `npm run release` tags and publishes the console image. |

Cranes pin `shotah/ai-gantry:latest`. Nested `repos/ai-gantry` is **dev
only**.

---

## Repo layout

```text
gantree/                    this repo — shipping yard
├── app/                    Vinext / Next-shaped UI
│   ├── lib/                browser helpers (yardFetch, jpeg, phone frame)
│   └── components/         nested by screen, not by widget type
│       ├── shared/         DoorShell, DashFold, HintField, avatars, EventStrip
│       ├── yard/           YardBoard, BuildCrane, HostCard, BoardsCard, SpendBoard
│       ├── boards/         BoardsDashboard (`/boards`)
│       ├── crane/          AgentDashboard + folds, Telegram, pendant, logs, charts
│       ├── host/           HostDashboard, HostCharts
│       └── operators/      AuthForms, OperatorProfile, YardSettings panes
├── site/                   GitHub Pages source (`npm run pages` → dist/pages)
├── assets/banner.svg       GitHub README banner
├── assets/banner.png       Hub overview (Hub does not render SVG)
├── assets/logo.svg         app icon mark (portal crane)
├── app/icon.svg            tab icon (SVG)
├── app/favicon.ico         tab icon (browsers that still ask for .ico)
├── assets/docs/            console screenshots (shot.mjs) + pitch stills
├── scripts/shot.mjs        headless Chrome recapture
├── scripts/pages.mjs       github.io tree from site/ + docs/*.md
├── scripts/seed.ts         screenshot operators, cranes, observe series
├── lib/yard/               host I/O (not RSC)
│   ├── door/               operators, session, audit events
│   ├── host/               dockerode, identity, stats, files, .env, avatar, telegram, logs
│   ├── crane/              inventory, build, run, doctor, telegram, pendant
│   ├── tools/              catalog, grant, mcp, auth
│   ├── observe/            stats samples, sqlite memory, spend rollup
│   └── shot/               screenshot yard (`npm run seed` + GANTREE_SHOT)
├── test/                   all tests — mirrors source, never next to it
│   ├── yard/               mirrors lib/yard
│   ├── app/                mirrors app/ (components by screen, lib helpers)
│   └── scripts/            mirrors scripts/
└── repos/                  local nested checkouts (gitignored)
    ├── ai-gantry/          harness — own remote, own git
    └── gantry-pendant/     phone mouth — own remote, own git
```

Nested checkouts are for **dev**. Runtime pins `shotah/ai-gantry:latest`
and speaks the file/env contract. Each nested project keeps its own
remote when you push. Do not copy `.env` or `data/` from a private
checkout.

`lib/yard` is the host I/O surface: inventory, build, grant/revoke,
doctor, run (start / stop / recreate), logs, stats, auth hop,
`tools-fetch`, Telegram / pendant allowlists, the operator door
(`lib/yard/door`, yard `gantree.db` — operators, sessions, graph
samples, audit). Import dockerode from `lib/yard`, not from `app/`.
Import leaf modules (`@/lib/yard/crane/build`), not a root barrel.
Client code that needs the pendant grammar imports
`@/lib/yard/crane/pendantShape` — not `pendant.ts` (that pulls Node I/O).

**Tests live under `test/`.** They mirror the source tree and never sit
beside production files. `test/yard/` covers `lib/yard` (Node / Docker /
files). `test/app/` covers the UI and `app/lib/` helpers. `test/scripts/`
covers `scripts/`. Coverage thresholds apply to `lib/yard` only.

**UI folders match screens** (`shared` / `yard` / `boards` / `crane` /
`host` / `operators`). Pages stay thin route shells. Do not invent
atoms/molecules or a `src/` wrap.

---

## Isolation

One human, one bot, one directory, one `data/`. Gantree does not merge
memories or OAuth across gantries. Delete a tryout = delete that
directory. The one shared bind is the yard corkboard (`./boards` →
`/boards` in the crane). Grant `boards` per crane; the yard Boards card
reads that directory and clicks through to the HTTP `/boards` page.
Messages stay private. Empty dir → empty card. Latest pins show on the
card; the page lists the rest.

Profiles (`slim` / `life` / `life-cast`) are build-time menus, not a
plugin system. Grant is still “listed in `mcp.toml`.” `life-cast` is
home-only (mDNS / host network). Custom servers:
[custom-mcp.md](custom-mcp.md).

---

## Later, and not the product

**Later** (when a real gap forces it): Workers portal (same `app/`,
remote to this host); operator saved watches / drag-and-drop tiles
(catalog + one attention surface before a dashboard builder); systemd
yards; a `gantree` CLI only if `npm` scripts are genuinely not enough
(still TypeScript); Prometheus; billed-provider invoices; SSO; Link
Google on `/profile` (OIDC that writes `sub` + email onto your row, not
a session).

**Not the product:** hosted Gantree SaaS, Kubernetes, Cloud Run /
Lambda, a shared family brain, pairing the *agent* through the console,
multi-tenant orgs, invite links, billing, anything that makes the
harness slower so this UI looks nicer.

Open items and stranger walks:
[docs/todo.md](https://github.com/shotah/gantree/blob/main/docs/todo.md).
