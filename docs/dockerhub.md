# gantree

**Operate your own [ai-gantry](https://github.com/shotah/ai-gantry) agents.** This
image is the shipping yard — a localhost board. Grant MCP, read logs, recreate.
Chat stays Telegram. Agents open **zero inbound ports.**

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

Also on GHCR: `ghcr.io/shotah/gantree` (same tags). Multi-arch: `linux/amd64`,
`linux/arm64`.

---

## What this image is

- **Operator plane**, not the chat. Node 22 + Vinext. Needs the Docker socket.
- Listens on `0.0.0.0:3000` *inside* the container so the port map works.
  The compose file still publishes `127.0.0.1:3000` on the host.
- Does not bake MCP binaries or `gantry.db`. Those stay on the host binds.

Harness image (the cranes): [`shotah/ai-gantry`](https://hub.docker.com/r/shotah/ai-gantry).
