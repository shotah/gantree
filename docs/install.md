# Install — home Mini or cloud VM

Same console. Same files. Agents still open **zero** inbound ports.
Only this UI is reachable, and only through a path you chose.

Harness image pin: `shotah/ai-gantry:latest` (Hub). Nested `repos/ai-gantry` is
dev only — do not copy `.env` or `data/` from a private checkout.

## Home (Mini / NUC)

Docker on the box. Cast / `life-cast` is allowed (mDNS, TV on the LAN).
Need **Node 22** (`node -v`). Distro `apt install npm` is often Node 20 and
will fail. Headless host, attach existing agents, tunnel, gotchas:
**[headless.md](headless.md)**. What the board is for:
**[console.md](console.md)**.

```bash
git clone https://github.com/shotah/gantree.git
cd gantree
cp gantree.toml.example gantree.toml
npm install
npm run build
npm start          # http://127.0.0.1:3000 — first boot is /setup
# or Hub / compose (LAN :80 → container :3000):
docker compose up -d
```

Open the board at `http://<pc-lan-ip>/` or
`http://<headless-lan-ip>/` (compose). Create the first operator, then
build a crane (yard = home). `npm start` stays `:3000`. Grant search.
Chat is Telegram — not this UI.

Local screenshots / `npm run dev`: `GANTREE_DEV=1` plus operator + passphrase
in `.env` ([.env.example](../.env.example)). Loopback only — compose
`HOST=0.0.0.0` ignores the flag. Unset it to photograph `/login`. Details:
[security.md](security.md#dev-auto-login) · [console.md](console.md).

![First operator — create the person who owns the box](../assets/setup.png)

![Log in](../assets/login.png)

Sessions live in `gantree.db` next to the checkout (compose: `var/gantree.db`).
That file is the yard’s sqlite — not a crane’s `data/gantry.db`. Forgot the
passphrase: delete it and run `/setup` again. Add a partner from **Operators**
in the header after login. What the door checks: [security.md](security.md).

## Cloud (your GCE / EC2)

Still your machine. Layout in the spirit of
[ai-gantry examples/hosting](https://github.com/shotah/ai-gantry/tree/main/examples/hosting)
(`/opt/gantree`, compose, Hub pull). `life-cast` is hidden.

```bash
sudo mkdir -p /opt/gantree
sudo git clone https://github.com/shotah/gantree.git /opt/gantree
cd /opt/gantree
cp gantree.toml.example gantree.toml
# gantree.toml: yard = "cloud"
GANTREE_LISTEN=127.0.0.1 docker compose up -d
```

On a cloud VM pin the publish to loopback (`GANTREE_LISTEN=127.0.0.1`).
The process inside still listens on `0.0.0.0` so the port map works; that
is not a public load balancer. Do not open a cloud firewall port to the world.

Reach it from a laptop:

**Tailscale** (preferred): install Tailscale on the VM, then Serve or an
SSH tunnel to `127.0.0.1:80` (compose). Do not open a cloud firewall port to the
world.

**Cloudflare Tunnel** (console only — never the agents):

```bash
cloudflared tunnel --url http://127.0.0.1:80
```

OAuth is always the laptop hop: **needs auth** → start hop or `/auth` in
Telegram → paste the code on the Tools screen.

Agents have no `ports:` in their compose. Do not add any.

A server that is not on the Tools grid: hand-edit that crane’s `mcp.toml`
([custom MCP](custom-mcp.md)).

## Image pin

New cranes use `shotah/ai-gantry:latest` (`DEFAULT_IMAGE` in `lib/yard/types.ts`
— that is the only place the tag lives). **pull + recreate** refreshes the
floating tag. Override a crane with a `0.x.y` tag only if you need to freeze.

**pull + recreate** runs `docker pull` then replaces the container as the
**host user that owns `data/`** (file owner, then the compose shell `UID`).
Distroless default uid `65532` cannot open a `gantry.db` written by your
login — that is `session store open failed`. Recreate without pull keeps that
uid too; it does not fetch a new image. Do not delete `data/` or re-import.

Console-in-Docker (sock + same-path binds): [headless.md](headless.md#8-console-in-docker).
Hub image: `shotah/gantree` (`latest` / `edge` / `0.x.y`). Same secrets as
ai-gantry on this GitHub repo: `DOCKER_HUB_USERNAME`, `DOCKER_HUB_ACCESS_TOKEN`.

## Release

No Makefile. This repo is npm.

```bash
npm test
npm run release:dry          # show next tag
npm run release              # patch bump, tag v*, push → Hub + GH Release
npm run release -- --bump=minor
```

Requires a clean tree. Updates `package.json` / lockfile, annotated `vX.Y.Z`,
moves floating git tag `latest`, pushes. CI builds `linux/amd64` only.
