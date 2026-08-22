# Headless host — first boot + attach existing agents

Gantree is **not** a downloadable bin. Clone it onto the **Docker host**,
`npm run build`, `npm start`. Default bind is **127.0.0.1:3000**. Chat stays
Telegram.

This page is the operator walk (Node 22, attach existing dirs, SSH tunnel).
Stranger hello: [install.md](install.md).

---

## Do not

- `sudo apt install npm` — distro Node is often **20**. Vinext needs **22**.
- Bind `0.0.0.0` on a **cloud** VM or open the port on a **WAN** firewall.
- Run the process as root to grab port 80.
- Run `npm audit fix --force`.
- `npm install-scripts approve *` — bash expands `*` to files in cwd.
- Type `vinext` on the shell — it is not on `PATH`. Use `npm run …`.
- **Recreate** or uncheck Tools on day one (drops host-network / UID / compose).
- Start the same Telegram bot on two machines (one `getUpdates` per bot).
- Copy a laptop `data/` over the host. Live OAuth is on the host.
- **Build a crane** for a slug that already has a `data/` — that writes a **new** empty dir.

---

## 1. Node 22 (on the host)

```bash
sudo apt remove -y nodejs npm
sudo apt autoremove -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v    # must be v22.x
npm -v
```

Do not `apt install npm` after this.

---

## 2. Clone

```bash
sudo mkdir -p /opt/gantree
sudo chown "$USER:$USER" /opt/gantree
git clone https://github.com/shotah/gantree.git /opt/gantree
cd /opt/gantree
cp gantree.toml.example gantree.toml
```

---

## 3. Attach agents that already exist

Leave each crane’s directory where it is. Point inventory at it.
Check names with `docker ps` (`container` must match).

```toml
yard = "home"

[[gantry]]
slug = "kit"
container = "kit"
data_dir = "/opt/agents/kit/data"
persona_dir = "/opt/agents/kit/persona"
mcp_manifest = "/opt/agents/kit/mcp.toml"
env_file = "/opt/agents/kit/.env"
```

Repeat one `[[gantry]]` block per agent.

Catalog is a **menu**. Enabled = that crane’s `mcp.toml`. `.env` stays theirs.
Do not use the Build wizard for these slugs.

`npm start` on the **host** can read those paths. Gantree’s own compose only
mounts `./gantries` — skip compose for this attach.

---

## 4. Install JS deps

```bash
cd /opt/gantree
npm install
```

If npm 11+ warns `install-scripts` / `allowScripts`, approve **by name**
(not `*`):

```bash
npm install-scripts approve cpu-features
npm install-scripts approve esbuild
npm install-scripts approve protobufjs
npm install-scripts approve ssh2
npm rebuild
```

Those four are dockerode / vite native bits. Without them, Docker or the
build will fail later.

---

## 5. Build, then start

Production start needs `dist/`. Background with `nohup` (already on the box):

```bash
cd /opt/gantree
npm run build
HOST=0.0.0.0 nohup npm start > gantree.log 2>&1 &
disown
```

Logs: `tail -f gantree.log`. Stop: `pkill -f "vinext start"`.

You want in the log: `Production server running at http://0.0.0.0:3000`

| Error | Fix |
| --- | --- |
| `does not provide an export named 'glob'` | Node 20. Redo step 1. |
| `No build output found in …/dist` | `npm run build` then `npm start`. |
| `vinext: command not found` | `npm run build` / `npm start`. |
| `EACCES` / Docker socket | add user to `docker` group, log out/in. |

---

## 6. Open it from another machine

The UI has **no login**. Whoever can load the page can read logs, edit
`.env`, and recreate containers. Default bind is localhost so a cloud
security group cannot do that by accident.

**Home LAN only** (no WAN port forward): listen on all interfaces, keep
port 3000.

```bash
# stop the old foreground npm start first (Ctrl-C), then:
HOST=0.0.0.0 nohup npm start > gantree.log 2>&1 &
disown
```

Browser: `http://<host-lan-ip>:3000`

Skip port 80. It needs root or `cap_net_bind_service`. Do not run this
app as root (`docker.sock`).

**Not on the LAN / cloud VM:** leave the default `127.0.0.1` bind.

```bash
ssh -N -L 3000:127.0.0.1:3000 user@host
```

Browser: **http://127.0.0.1:3000**. Tailscale Serve to that same loopback
is the other path. Never open 3000 on a cloud firewall.

---

## 7. Day one — look only

You should see one card per `[[gantry]]`. Click → logs / doctor.

- **Do not** Recreate.
- **Do not** uncheck Tools.
- Start / stop still: that crane’s existing compose on the host.

Grant + recreate from the UI comes after recreate preserves host network,
UID, and the existing compose file.

---

## Backup vs tokens

A DB snapshot (`gantry.db` + `SELF.md`) is **not** OAuth. Tokens live under
`data/.config/` on the host. A laptop copy without that tree cannot stand
the bots up. Do not rsync laptop `data/` over the host.

Telegram: **one** `getUpdates` per bot. Do not start the same bot in two places.

---

## Keep it running

Stop: `pkill -f "vinext start"`. After `git pull`: `npm install` → `npm run build` → the `nohup npm start` line in step 5.
