# gantree — todo

Work backwards from v1. This file is the build script: what “done” looks
like, then the milestones in the order we walk them. Pitch lives in
[README.md](README.md). Long-form design:
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
named cards. Click Kit: **that instance’s** dashboard — CPU/RAM and
turn graphs, plus a visual log (not a raw dump). Enable Google. OAuth
in a browser. Recreate. `/tools` in Telegram shows `google__…`.
No toml archaeology. No SSH folklore at 11pm.

**Cloud.** Same app on a small VM (`/opt/gantree` + compose).
`npm start` (or the console container). Tailscale or Cloudflare
Tunnel from a laptop. Plant `slim`. Laptop OAuth. Same Tools screen.
Agents still have **no inbound ports**. Cast is hidden.

**Operator loop that must work end-to-end**

1. `npm start` (or compose) on the Docker host
2. Board shows every gantry in `gantree.toml` — alive or not
3. Click a card: per-instance graphs + visual logs (Kit ≠ partner ≠ tryout)
4. Plant a new one (yard type → slug → model → channel → profile)
5. Grant / revoke MCP; files update; container recreates
6. Watch *that* agent’s log and metrics until the grant is real
7. Doctor says why something is skipped (no binary / no key / no OAuth)

If that loop is a nicer rsync, we missed. The product is the yard
you can *see*.

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
| Plant | Wizard: home vs cloud, slug, persona seed, model, channel + token + allowlist, `slim` / `life` / `life-cast` |
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

Scaffold Vinext on Node and prove `lib/yard` can see one local gantry
container — inspect + logs. Everything else hangs off that.

---

## Milestone 0 — repo + Vinext on Node

Empty console that boots on the Docker host. No gantries yet.

- [x] Public repo `shotah/gantree`, MIT, README pitch
- [x] `repos/` nested checkouts (gitignored, `.gitkeep`); `ai-gantry` stacked
- [x] This todo (v1 end-state + walk order)
- [ ] `npx vinext create --platform=node` (or equivalent) → `app/`
- [ ] TypeScript strict, lint, format
- [ ] `lib/yard/` package stub — no RSC imports of dockerode
- [ ] `npm start` → `vinext start` (dev: `npm run dev` / `vinext dev`)
- [ ] Bind `127.0.0.1` by default (`HOST`, not `HOSTNAME`)
- [ ] Compose for the console itself (optional, same host)
- [ ] CI: lint + typecheck + unit tests
- [ ] **Walk:** `npm start`, browser opens a blank yard on localhost

---

## Milestone 1 — see one crane

First useful product: one existing container, alive or not, and its logs.
Attach to a gantry that was planted by hand (today’s compose). Do not
plant yet.

- [ ] dockerode (or Docker HTTP API) behind `lib/yard`
- [ ] Discover: name, state, image, started-at, health
- [ ] `GET` logs (last N) + live tail (SSE or chunked)
- [ ] Parse JSON slog lines when present (last error / last turn if logged)
- [ ] Read-only file peek: `mcp.toml` exists? `.env` keys present (names only)?
- [ ] Route handlers only — `app/api/…` calls `lib/yard`
- [ ] **Walk:** point Gantree at one running `shotah/ai-gantry` container,
      see status + streaming logs. No SSH.

---

## Milestone 2 — inventory + board

A handful of named pets, not a Kubernetes dashboard.

- [ ] `gantree.toml` — ids, slugs, compose project / container name, data dir.
      No secrets.
- [ ] `lib/yard.list()` merges toml + Docker inspect
- [ ] Yard home UI: one card per gantry
- [ ] Card: name, alive, model, channel, published vs skipped (best-effort),
      last error, last turn
- [ ] Click-through to that instance’s dashboard (M3)
- [ ] **Walk:** two or three hand-planted gantries appear as cards.
      Stop one; the card goes dark without a refresh hunt.

---

## Milestone 3 — per-agent dashboard (graphs + visual logs)

Each `ai-gantry` instance gets its own page. This is why the console
exists at 11pm: *this* crane, *this* turn, *this* spike — not a
shared syslog.

Still pull-only. Sample while Gantree is up. No Prometheus in v1.
No port on the harness.

**Graphs** (import a chart lib — Recharts / uPlot / similar)

- [ ] Sample `docker stats` on an interval into a **per-slug ring
      buffer** (in memory is enough for v1; last ~1h and ~24h)
- [ ] Host: CPU %, memory (cgroup already includes MCP children)
- [ ] Turn: turns / time, Completer rounds, recoveries, est. tokens
      — parsed from JSON slog (`/perf` shape), not guessed from
      plaintext
- [ ] MCP: published vs skipped over time (from doctor / status)
- [ ] Restarts / uptime from Docker inspect
- [ ] Board sparklines optional; full charts live on the agent page
- [ ] Missing slog fields stay empty — don’t fake a line

**Visual logs** (one stream per instance, never mixed)

- [ ] Structured viewer: time, level, message; pretty-print JSON slog
- [ ] Live tail (SSE) + last-N backfill
- [ ] Filter: level, text search, tool / skip / error highlights
- [ ] Group by turn when a turn id (or equivalent) is in the line
- [ ] Pause / follow; no secrets rendered (redact `.env`-shaped values)
- [ ] Kit’s log URL cannot show the partner’s container

- [ ] **Walk:** two gantries running. Open Kit — graphs move, log
      highlights a tool skip. Open the other card — different lines,
      different CPU. Stop Kit; its chart flatlines, the other does not.

---

## Milestone 4 — doctor

“Healthy container, zero tools” is a fail. The console says *why*.

- [ ] Per-gantry doctor: Docker health + `gantry status` exec + files
- [ ] Checks: persona present, `mcp.toml` listed vs skipped, binary on
      PATH / volume, required env keys (names), OAuth session yes/no
- [ ] Distinguish: no binary vs no key vs no OAuth vs process dead
- [ ] Harness ask if `gantry status` / `doctor` is too thin — push into
      `ai-gantry` when every consumer benefits (see below)
- [ ] **Walk:** skip a server (rename the binary). Doctor names the miss.
      Card does not say healthy.

---

## Milestone 5 — run

Start / stop / recreate. Env change **recreates** (restart keeps ghost
allowlists).

- [ ] `lib/yard` start / stop / recreate via compose (preferred) or
      container API
- [ ] Image pin on the card (Hub tag); pull + recreate
- [ ] Recreate waits until doctor is green-or-honest, not just “started”
- [ ] Backup: copy `gantry.db` + `SELF.md` to a timestamped dir (no `.env`)
- [ ] **Walk:** recreate Kit from the UI. Logs show boot. Telegram still
      answers. Backup file exists.

---

## Milestone 6 — files are the editor

UI writes the same files you would hand-edit. Still no plant wizard.

- [ ] Read / write `mcp.toml` (structured, not a blob dump)
- [ ] Read / write `PERSONA.md`; show `SELF.md` with a prune hint
      (harness keeps writing it)
- [ ] Secrets form → `.env` / `data/`; never git; never log values
- [ ] Token push is an explicit confirm (“this overwrites the bot token”)
- [ ] Deploy / recreate of config does **not** copy `data/` by default
- [ ] **Walk:** edit persona in the UI, recreate, agent voice changes.
      Edit `mcp.toml` by hand; UI shows the same grant.

---

## Milestone 7 — Tools (the killer screen)

MCP **is** the grant. This is the screen v1 is for.

- [ ] Catalog of known servers (google, search, math, garmin, …) + custom
- [ ] Toggle on → write `[[server]]` → `tools-fetch` → recreate → wait
      until doctor / `/tools` shows the prefix
- [ ] Toggle off → omit from manifest → recreate (bins may stay on disk)
- [ ] Per server: binary present, env keys required, OAuth session,
      skipped-at-boot
- [ ] Profiles as plant-time menus only: `slim` (search+math), `life`,
      `life-cast` (home only). Toggles can go past the profile.
- [ ] **Walk:** enable Google for Kit from the board. No toml archaeology.
      Telegram `/tools` lists `google__…`.

---

## Milestone 8 — auth hop

“Needs auth” is a button, not a wiki page.

- [ ] Detect needs-auth from doctor
- [ ] Home: localhost hop **or** kick `/auth` in chat and paste the code
- [ ] Cloud: laptop hop only (no Mini browser, no Cast)
- [ ] Hide / refuse `life-cast` when yard type is cloud
- [ ] **Walk:** dead Google token → button → OAuth → recreate → tools live.

---

## Milestone 9 — plant

New gantry in two minutes, not an afternoon of compose.

- [ ] Wizard: **yard type first** (home Mini vs cloud VM)
- [ ] Then: slug, persona seed (or blank `PERSONA.md`), model
      (Gemini / ChatGPT / Ollama), channel + bot token + allowlist,
      profile
- [ ] Writes an isolated directory (`gantries/<id>/`)
- [ ] Fetches bins, creates compose service, shows doctor
- [ ] Isolation: delete the directory = gone
- [ ] **Walk:** plant `slim` for a friend. Second card. Their allowlist,
      their OAuth, their `data/`. Yours untouched.

---

## Milestone 10 — two yards, one product

Same console. Host chosen at plant / init time.

- [ ] Home: compose on the box, `npm start`, console on `127.0.0.1`
      or Tailscale. Cast allowed.
- [ ] Cloud: same stack on a VM, layout in the spirit of
      [ai-gantry examples/hosting](repos/ai-gantry/examples/hosting)
      (`/opt/gantree`, compose, CI pulls the harness image)
- [ ] Console never `0.0.0.0` on the public internet
- [ ] Cloud docs: Tailscale or Cloudflare Tunnel to Gantree only
- [ ] **Walk (home):** stranger clones this repo, `npm start`, plants
      one gantry in the UI, grants search, chats on Telegram.
- [ ] **Walk (cloud):** same from a laptop over Tailscale. No Cast.
      Agents have no inbound ports.

---

## Milestone 11 — hello path

A stranger does either story without reading anyone’s private git.

- [ ] Root README hello: clone → `npm start` → attach or plant
- [ ] No `.env` or `data/` copied from a private checkout
- [ ] Pin `shotah/ai-gantry` by Hub tag; nested `repos/ai-gantry` is
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
