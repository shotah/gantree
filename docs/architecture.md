# Architecture

Gantree is the **operator plane** for
[ai-gantry](https://github.com/shotah/ai-gantry): a shipping yard, not the
chat. The crane is the product — why the harness is worth operating lives
in the [root readme](../README.md). What you click on the board:
[console.md](console.md). People (login, profile, settings):
[operators.md](operators.md). This page is how the yard is put together —
stack, host I/O, and why the console never sits in a chat turn.

Harness-side design note (nested checkout, **dev only**):
[repos/ai-gantry/docs/gantree.md](../repos/ai-gantry/docs/gantree.md).

---

## Operator plane

```text
[ browser ]
     |
     |  localhost | Tailscale | Cloudflare Tunnel | nginx-proxy (console only)
     v
[ gantree  — Vinext on Node, on the Docker host ]
     |
     |  Docker API + files on disk
     v
[ gantry ] [ gantry ] [ gantry ]     Hub image, outbound chat
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
v1 is therefore **Vinext targeting Node** (`--platform=node` /
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
host. That is a second skin, not v1. Tailscale or a Cloudflare Tunnel
in front of the Node console is how you reach a cloud VM today.

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
| CPU / RAM / net graphs | sampled `docker stats` / cgroup (ring + yard sqlite, 7d cap). Host card rolls containers up by role (agents / dashboard / other). |
| Turn / token graphs | JSON slog `turn perf` (`prompt_est_tokens`, `gen_est_tokens`, `iterations`, `user_id`) — same sqlite so a bounce keeps this billing month (local 1st) |
| Published vs skipped MCP | `mcp.toml` + `gantry status` JSON (`mcp.servers[].reason`: `no_binary` / `no_key` / `no_oauth`) |
| Persona, secrets | `PERSONA.md`, `avatar.jpg`, `.env`, `data/` on disk |
| Telegram bot | Bot API `getMe` / `setMy*` after a token exists. Allowlist is `.env`. Never `getUpdates`. |

Files remain the source of truth. The UI is an editor of those files,
not a second inventory. Secrets never go in git. Console-in-Docker must
see those files at the inventory path — uncomment the same-path volume in
`compose.yml` when attaching absolute host dirs ([headless.md](headless.md#8-console-in-docker)).
Metrics and container env still work without it; persona and `mcp.toml` do not.

Inventory is `gantree.toml` (no secrets). One mutation path: the UI
calls `lib/yard`. Never dockerode from a React Server Component.

**Meh yard, tight crane.** The operator can wait 200ms for a chart. The
human on Telegram cannot wait for a serial tool loop. Never add a listen
port, a scrape, or a hook that taxes parallel tool calls, Completer
rounds, or RSS. If a dashboard want would make `ai-gantry` slower, the
want is wrong.

Recreate / pin **keep** the crane’s host `user` (Vinext uid:gid, never
image `65532`), `network_mode`, and extra binds. Dropping uid is how
`session store open failed` happens: Distroless cannot write a
`gantry.db` owned by your login.

---

## Repo layout

```text
gantree/                    this repo — shipping yard
├── app/                    Vinext / Next-shaped UI
│   ├── lib/                browser helpers (yardFetch, jpeg, phone frame)
│   └── components/         nested by screen, not by widget type
│       ├── shared/         DoorShell, DashFold, HintField, avatars, EventStrip
│       ├── yard/           YardBoard, BuildCrane, HostCard, SpendBoard
│       ├── crane/          AgentDashboard + folds, Telegram, logs, charts
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
│   ├── crane/              inventory, build, run, doctor
│   ├── tools/              catalog, grant, mcp, auth
│   ├── observe/            stats samples, sqlite memory, spend rollup
│   └── shot/               screenshot yard (`npm run seed` + GANTREE_SHOT)
├── test/                   all tests — mirrors source, never next to it
│   ├── yard/               mirrors lib/yard
│   ├── app/                mirrors app/ (components by screen, lib helpers)
│   └── scripts/            mirrors scripts/
└── repos/                  local nested checkouts (gitignored)
    └── ai-gantry/          harness — own remote, own git
        └── repos/          MCP servers — own remotes
```

Nested checkouts are for **dev**. Runtime pins `shotah/ai-gantry:latest`
and speaks the file/env contract. Each nested project keeps its own
remote when you push. Do not copy `.env` or `data/` from a private
checkout.

`lib/yard` is the host I/O surface: inventory, build, grant/revoke,
doctor, run (start / stop / recreate), logs, stats, auth hop,
`tools-fetch`, the operator door (`lib/yard/door`, yard `gantree.db` —
operators, sessions, graph samples, audit). Import dockerode from
`lib/yard`, not from `app/`. Import leaf modules (`@/lib/yard/crane/build`),
not a root barrel.

**Tests live under `test/`.** They mirror the source tree and never sit
beside production files. `test/yard/` covers `lib/yard` (Node / Docker /
files). `test/app/` covers the UI and `app/lib/` helpers. `test/scripts/`
covers `scripts/`. Coverage thresholds apply to `lib/yard` only.

**UI folders match screens** (`shared` / `yard` / `crane` / `host` /
`operators`). Pages stay thin route shells. Do not invent
atoms/molecules or a `src/` wrap.

---

## Isolation

One human, one bot, one directory, one `data/`. Gantree does not merge
memories or OAuth across gantries. Delete a tryout = delete that
directory.

Profiles (`slim` / `life` / `life-cast`) are build-time menus, not a
plugin system. Grant is still “listed in `mcp.toml`.” `life-cast` is
home-only (mDNS / host network). Custom servers:
[custom-mcp.md](custom-mcp.md).

---

## v1 vs v2 vs v3 vs later

**v1:** this Node process on the Docker host, or the Hub image
`shotah/gantree` with `docker.sock`. Board, per-crane dashboard, host
page (`gantree.toml` + yard sqlite),
build wizard, MCP toggles, auth hop, start / stop / recreate, image pin.
Telegram + Hub `shotah/ai-gantry`. Bind localhost (LAN publish is a
home choice). `npm run release` tags and publishes
the console image (same Hub secrets as the harness).

**v2 (delivered):** a door on that process (setup + login + session on
every API and log SSE), a handful of operators in yard `gantree.db`
(independent of each crane’s `gantry.db`; admin sees every crane, user /
readonly their assigned), board nags for skipped MCP / needs-auth,
sqlite so graphs survive a bounce, audit of who mutated what. What that
door checks: [security.md](security.md). Portal (Workers skin) is a
parallel / last walk with mobile — not a blocker for calling the door
done. Walk: [todo.md](../todo.md) (**v2 looks like**).

**v3:** the yard you live in. Settings beyond people (retain, timezone,
default pin, optional $/1M). Richer pull-only graphs (net, disk, turn
duration when slog has it). Profile chat ids label spend and can be
pushed onto a crane allowlist. Backup is a loop (list / restore /
prune); retire a tryout. Compare overlay and a filterable audit.
Inventory still toml. Still pull, never a `/metrics` port on the crane.
Mobile / phone layout is someone else’s track. Walk: [todo.md](../todo.md)
(**v3 looks like**).

**Later:** systemd yards; a `gantree` CLI only if `npm` scripts are
genuinely not enough (still TypeScript); Prometheus; billed-provider
invoices; SSO.

**Not the product:** hosted Gantree SaaS, Kubernetes, Cloud Run / Lambda,
a shared family brain, pairing the *agent* through the console, anything
that makes the harness slower so this UI looks nicer.

Walk order: [todo.md](../todo.md).
