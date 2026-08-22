# gantree

<p align="center">
  <img src="assets/banner.svg" alt="Shipping yard for personal agents - operator plane, not the chat" width="100%">
</p>

<p align="center">
  <a href="https://github.com/shotah/gantree/actions/workflows/ci.yml"><img src="https://github.com/shotah/gantree/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/shotah/gantree/actions/workflows/ci.yml"><img src="https://github.com/shotah/gantree/raw/gh-pages/badges/coverage.svg" alt="Coverage"></a>
  <a href="https://github.com/shotah/gantree"><img src="https://img.shields.io/github/package-json/v/shotah/gantree?label=version" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/shotah/gantree" alt="License"></a>
</p>

The shipping yard for [ai-gantry](https://github.com/shotah/ai-gantry).

The harness is a **crane**: one process, one persona, one model, one
`data/`. It talks to a human in Telegram. It does not grow a settings
page.

**Gantree** is the shipping yard — where you operate cranes. See them.
Build a new one. Grant Google, yank Strava, notice a dead token,
recreate, read logs. Chat stays the agent’s mouth. This is the
operator’s.

```text
[ browser ]
     |
     |  localhost | Tailscale | Cloudflare Tunnel (console only)
     v
[ gantree  — Vinext on Node, on the Docker host ]
     |
     |  Docker API + files on disk
     v
[ gantry ] [ gantry ] [ gantry ]     Hub image, outbound chat
```

Agents open **zero** inbound ports. Gantree never sits in a chat turn.
If you expose the console, you expose it to yourself.

The shipping yard is allowed to be a bit meh. It is JS, in a browser,
for an operator who clicks a few cranes. The crane is not. [ai-gantry](https://github.com/shotah/ai-gantry)
is a tight Go harness — parallel tool batches, cheap Completer
rounds, small RSS — and that speed is the product the *human* feels.
Gantree reads Docker and files after the fact. It does not get a vote
in the tool loop.

---

## Why a framework — and why Vinext

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
| UI (`app/`) | Vinext / React | Shipping yard, build crane, Tools, graphs + logs |
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

---

## How gantree sees a gantry

The crane does not grow a `/metrics` port. Gantree **pulls**.

| What you want | Where it comes from |
| --- | --- |
| Alive, image, restart | Docker inspect / compose |
| Visual logs (per instance) | `docker logs` stream, structured in the UI |
| CPU / RAM graphs | sampled `docker stats` / cgroup (ring buffer) |
| Turn / token graphs | JSON slog (`/perf` shape) on container stderr |
| Published vs skipped MCP | `mcp.toml` + harness `doctor` / `status` |
| Persona, secrets | `PERSONA.md`, `.env`, `data/` on disk |

Files remain the source of truth. The UI is an editor of those files,
not a second inventory. Secrets never go in git.

The process is Vinext on Node. No second language, no `gantree` CLI
until we actually need one:

```bash
npm start          # vinext start — bind 127.0.0.1
npm run dev        # vinext dev
```

---

## Who it’s for

An advanced home operator. You own the agents and the box. You might
run several (you, a partner, a tryout). You run Docker — on a Mini in
the living room, or an `e2-small` / `t3.small` so it is not your house
power bill.

Not for: team inboxes, multi-agent routers, “ChatGPT for work,” or
selling per-customer agent instances as a SaaS.

---

## v1

One runtime: Linux + Docker + Vinext Node on that host. Two install
stories: home Mini, or your GCE/EC2.

- Board of named cranes (not a Kubernetes dashboard)
- Per-crane dashboard: metric graphs + visual logs (one page per instance)
- Build-a-crane wizard (yard type first, then slug / model / channel / profile)
- MCP grant toggles that write `mcp.toml`, fetch bins, recreate
- Start / stop / recreate, image pin
- Bind `127.0.0.1` by default
- Telegram + Hub image `shotah/ai-gantry:0.1.66`

**Not v1:** `gantree` CLI / Go binary, Workers portal, systemd yards,
hosted Gantree, Kubernetes, pairing chat through the console.

Design notes from the harness side:
[gantree proposal](repos/ai-gantry/docs/gantree.md)
(nested checkout; see below).

---

## Repo layout

```text
gantree/                    this repo — shipping yard
├── app/                    Vinext / Next-shaped UI
├── assets/banner.svg       README banner (name stays in the heading)
├── lib/yard/               Docker + files (not RSC)
└── repos/                  local nested checkouts (gitignored)
    └── ai-gantry/          harness — own remote, own git
        └── repos/          MCP servers — own remotes
```

Nested checkouts are for **dev**. Runtime pins `shotah/ai-gantry:0.1.66` and
speaks the file/env contract. Each nested project keeps its own remote when
you push. Do not copy `.env` or `data/` from a private checkout.

---

## Hello

Docker on the same host. Linux.

```bash
git clone https://github.com/shotah/gantree.git
cd gantree
cp gantree.toml.example gantree.toml
npm install
npm start                 # http://127.0.0.1:3000
```

Build a crane from the board (yard type first). Click the card for graphs +
logs. Grant a tool, recreate, watch *that* crane’s doctor. Chat stays in
Telegram.

Home Mini vs cloud VM (Tailscale / Cloudflare Tunnel, never a public
`0.0.0.0`): [docs/install.md](docs/install.md). Your own MCP binary:
[docs/custom-mcp.md](docs/custom-mcp.md).

```bash
npm run dev               # Vinext dev, still 127.0.0.1
docker compose up -d --build
```

Walk order and leftover walks: [todo.md](todo.md).

License: [MIT](LICENSE).
