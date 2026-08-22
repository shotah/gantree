# gantree

![gantree — shipping yard for personal agents](https://raw.githubusercontent.com/shotah/gantree/main/assets/banner.png)

**Operate your own [ai-gantry](https://hub.docker.com/r/shotah/ai-gantry) agents.**
This image is the shipping yard — a localhost board. Spawn a crane, grant MCP,
read logs, recreate. Chat stays Telegram. Agents open **zero inbound ports.**

```text
browser  →  gantree (localhost | Tailscale | tunnel)  →  Docker + files
                                                         gantry  gantry  gantry
```

Source: [github.com/shotah/gantree](https://github.com/shotah/gantree)

---

## Quick start

```bash
docker pull shotah/gantree:latest
export GANTREE_CRANE_USER="$(id -u):$(id -g)"
docker compose up -d
```

Compose must mount `docker.sock` and the yard files (`gantree.toml`, `gantries/`).
Publish **`127.0.0.1:3000` only**. Do not bind `0.0.0.0` on a cloud VM.

Cranes must run as the host user that owns `data/` — Distroless default uid
`65532` cannot open `gantry.db`. That is what `GANTREE_CRANE_USER` is for.

Walkthrough: [docs/headless.md](https://github.com/shotah/gantree/blob/main/docs/headless.md)

---

## Tags

| Tag | Meaning |
| --- | --- |
| `latest` | Last successful publish (`main` or a `v*` tag) |
| `edge` | Tip of `main` (moving) |
| `0.x.y` / `0.x` | Pinned release (prefer for production) |
| `sha-<commit>` | Exact CI build |

Also on GHCR: `ghcr.io/shotah/gantree` (same tags). `linux/amd64` only.

---

## What this image is

- **Operator plane**, not the chat. Node 22 + Vinext. Needs the Docker socket.
- Spawns and operates [`shotah/ai-gantry`](https://hub.docker.com/r/shotah/ai-gantry)
  cranes (one container, one persona, one `data/` each).
- Listens on `0.0.0.0:3000` *inside* the container so the port map works.
  The compose file still publishes `127.0.0.1:3000` on the host.
- Does not bake MCP binaries or `gantry.db`. Those stay on the host binds.

Harness image (the cranes): [`shotah/ai-gantry`](https://hub.docker.com/r/shotah/ai-gantry).

---

## Hub metadata (maintainers)

This file is what CI publishes to the Docker Hub **overview**
(`.github/workflows/dockerhub-description.yml` and the Hub overview step in
`docker.yml`). Keep it pull-first and under Hub’s ~25KB cap. Do **not** paste
the full root `README.md` here.

**Categories** (Hub UI only — pencil under the short description, max 3):

1. **Machine learning & AI**
2. **Developer tools**
3. **Monitoring & observability** *(board / logs / spend — not in the token path)*

**Short description** is set by the same workflow (≤100 chars):
`Shipping yard for ai-gantry. Operate personal agents. Chat stays Telegram.`

Banner must be **PNG** with an absolute `raw.githubusercontent.com` URL — Hub
does not render our SVG reliably. After editing `assets/banner.svg`:

```bash
rsvg-convert -w 2560 assets/banner.svg -o assets/banner.png
```
