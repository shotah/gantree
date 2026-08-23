# Security — the door

The product is a yard you can put on a **LAN** without trusting everyone
on it. This page is what the door actually does — and what it does not.

Login is **defense in depth**, not a reason to open a WAN port. Cloud VM
still pins loopback + Tailscale / tunnel. Home compose may publish `:80`
on the LAN *behind* this door. Agents still open **zero** inbound ports.

Walk: [console.md](console.md). Login, profile, settings:
[operators.md](operators.md). Bind stories: [install.md](install.md).
Stack: [architecture.md](architecture.md). Code: `lib/yard/door/`.

---

## What this is for

Stop a **stupid slip** that lets a stranger walk in: empty passphrase,
`null` coerced to `"null"`, `password123`, unlimited guesses, a session
that outlives a password change.

A volumetric flood can still knock the process over. That is not the bar.
The bar is: they do not get logs, `.env`, or recreate without a real
passphrase.

Whoever *can* log in is not automatically an owner. Three roles, one field
each — not a permission matrix:

| Role | Access |
| --- | --- |
| **admin** | Every crane. Operators. Build. |
| **user** | Assigned cranes (card, details, grant, recreate, env). Not operators, not other cranes. |
| **readonly** | Assigned cranes — look (card, logs, doctor). Not touch. Not other cranes. |

Setup always creates an **admin**. Assign the rest from **Settings** (the
cog). Profile (name, photo, passphrase) is a different page — click your
name. A user or readonly without a crane is a misconfig — the add form
requires at least one. Tick several when one person covers more than one
bot. Only admin sees every crane. Do not share an admin login
the way you would share a read-only dashboard.

---

## Bind

| How you run it | Who can reach the UI |
| --- | --- |
| `npm start` (default) | `127.0.0.1:3000` only |
| `HOST=0.0.0.0 npm start` | that host’s interfaces, `:3000` |
| compose (default) | host `:80` on `0.0.0.0` → container `:3000` |
| compose + `GANTREE_LISTEN=127.0.0.1` | host loopback `:80` only |
| `compose.cloudflare.yml` | LAN `:80` + Cloudflare Tunnel (no WAN ports) |
| `compose.nginx.yml` | host `:80`/`:443` (nginx-proxy) → gantree unpublished |

`npm start` already sets loopback. Compose sets `HOST=0.0.0.0` *inside*
the container so the port map works; that is not “open the cloud
firewall.” On a VM use `GANTREE_LISTEN=127.0.0.1` and Tailscale or a
tunnel. A partner who only needs keys is a **user** on their crane.
Do not WAN-forward `:3000` / `:80` and hope login is enough.

Public hostname: **Cloudflare Tunnel** (`compose.cloudflare.yml`) if the
zone is on Cloudflare — no router ports. Origin TLS on this box is
`compose.nginx.yml` (grey cloud, WAN 80+443). Login is still the door.

If `HOST` is `0.0.0.0` / `::` and there are **no** operators yet, the
process warns once: only `/setup` is live. Create the first operator
before you leave the box on a LAN.

---

## First boot

Empty yard → **`/setup`** is the only mutating door. Everything else
401s with `{ setup: true }`. Setup creates **one** operator and a
session. A second setup is `409 already set up`.

There is no setup token. On an open bind, **whoever POSTs `/api/setup`
first owns the box.** That is the product (you are standing at the Mini)
and also the window: do not publish LAN `:80` and walk away before
setup. After the first operator exists, setup is closed.

Forgot the passphrase: stop, delete yard sqlite (`gantree.db`, compose:
`var/gantree.db`), start, run setup again. No email, no reset link.

---

## The door

Every `/api/*` that can read or mutate the yard goes through `withDoor`
(`lib/yard/door`). Exceptions: `/api/setup`, `/api/login`, `/api/logout`,
`/api/door` (status only — ready / you / bind-open, not the operator
list).

The browser shell (`DoorShell`) sends you to `/setup` or `/login`. That
is UX. **The APIs are the lock.** Pages do not load `.env` or logs in
the HTML; they fetch after a session exists.

Mutations that already existed (grant, recreate, env, operators) also
write a small audit row (who, what). Login and logout do too; only
admin can read those. Not a SIEM.

---

## Passphrases

Same rules for `/setup`, **Add a partner**, **Change your passphrase**,
and `GANTREE_DEV_PASSPHRASE`. Login still accepts whatever hash is
already stored (so an old passphrase is not locked out by a later
policy bump). New ones must pass.

| Rule | Why |
| --- | --- |
| Must be a JSON **string** | `null`, `1234567890`, `["pw"]` are 400, not coerced |
| 10–128 characters | short is guessable; huge is a scrypt stall |
| Not blank / not whitespace-only | HTML `required` is not the check |
| Not your operator name, and not that name repeated | `kitkitkitkit` |
| Not all digits, not fewer than 4 distinct characters | `1234567890`, `aaaaaaaaaa` |
| Not a common / padded-stupid value | `password123`, `null      `, `none`, keyboard runs, `Summer2024` |
| Not the current passphrase on change | pick a different one |

Names are `2–32` letters, digits, `.` `_` `-`. Case-insensitive unique.
The forms also set `minLength` / `maxLength` / a name `pattern` so the
browser does not invite a slip. The server is the source of truth.

Hashes: `node:crypto` **scrypt** (N=16384, r=8, p=1, 32-byte hash, 16-byte
random salt). Never stored plaintext. Never logged. Never sent back to
the browser. The sqlite file on disk should not contain the passphrase
or the raw session token.

---

## Login

`POST /api/login` with `{ name, passphrase }` strings. Wrong or unknown:

- Same error: `invalid name or passphrase` (no user enumeration).
- Unknown name still runs a dummy scrypt so timing is not a tell.
- Oversized body is not fed to scrypt.

Backoff (in memory, per process — a bounce clears it):

| Bucket | Trip | Then |
| --- | --- | --- |
| Per name (case-insensitive) | 8 failures in 15 minutes | `429 too many attempts, try later` for 15 minutes, **including the right passphrase** |
| Global | 40 failures in 15 minutes | same 429 for everyone |

That can lock *you* out if someone sprays. Accepted: better than
unlimited guesses. Wait, or bounce the process if you are sure it is
you and the box is not under attack.

Empty yard: login returns `setup: true` and does not count toward
lockout.

---

## Sessions

| Piece | Value |
| --- | --- |
| Cookie | `gantree_session` |
| Flags | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when the request is HTTPS (`x-forwarded-proto` or `https:` URL) |
| Token | 32 random bytes, hex. Sqlite stores **SHA-256** of it, not the token |
| Idle | 7 days (bump `last_seen` at most once a minute) |
| Absolute | 30 days from login (cookie `Max-Age` matches) |
| Logout | deletes that row + `Max-Age=0` cookie |

Phone + laptop can both be logged in. Changing your passphrase **drops
every other session** and keeps the one you used to change it. Removing
an operator cascades their sessions (`ON DELETE CASCADE`).

SameSite=Lax + `credentials: "same-origin"` on fetches. This is not a
JWT in `localStorage`.

---

## Operators

A handful of people in yard sqlite. Confirm-scary on add / remove /
access change / passphrase change (checkbox must be JSON `true`, not
`"true"`).

- Each row is a UUID. `bob` is the login name. Display name, email, description, photo, and Telegram/Slack/Discord ids live on that row. Email is a label — still no reset link. Photos: `operators/<uuid>/avatar.jpg` next to yard sqlite.
- Cannot delete the last operator. Cannot demote or delete the last admin.
- Add uses the same passphrase rules as setup.
- Names are unique ignoring case.
- Hashes never round-trip on `GET /api/operators`.
- Role lives on the operator row (`admin` / `user` / `readonly`). User and
  readonly also have `crane_slug` (JSON list of slugs; a leftover single
  slug still reads). Profile edits (name, email) cannot
  change role — that is Settings. Only admin lists every crane.
- Non-admins `GET /api/operators` see only themselves. Mutations other
  than own passphrase / profile are 403.

---

## Dev auto-login

`GANTREE_DEV=1` + `GANTREE_DEV_OPERATOR` + `GANTREE_DEV_PASSPHRASE` mints
a real session **only when `HOST` is loopback**. Compose sets
`HOST=0.0.0.0`, so the flag is ignored on a LAN publish even if you
paste it into the container env. Do not set these in `compose.yml`.

The passphrase still has to pass the same rules (`bob-dev-ok` does).
Unset the flag to photograph `/login`.

---

## Disk

| File | Secrets? |
| --- | --- |
| `gantree.toml` | No. Inventory only. |
| yard `gantree.db` / `var/gantree.db` | Yes. Operator hashes, session hashes, samples, audit. Gitignored. Not a crane’s `data/gantry.db`. |
| each crane `.env`, `data/`, OAuth files | Yes. On disk next to that crane. Login gates the *UI* that edits them; Unix file mode still matters. |
| `mcp.toml` | Grant list. Tokens live in `.env` / `data/`, not in the manifest if you kept the usual layout. |

WAL sqlite, foreign keys on. Treat `gantree.db` like a password file:
backups are backups of hashes, not of a backdoor, but they are still
the operator table.

---

## Cranes

The door is the **console**. Each crane is still outbound-only: no
`ports:` on the agent compose, no `/metrics` scrape, no inbound chat
webhook you did not choose. Gantree **pulls** Docker and files.

Isolation: one human, one bot, one directory, one `data/`. The yard does
not merge memories or OAuth across cranes. Telegram allowlists stay on
the crane.

OAuth for tools is a laptop hop (or paste from `/auth` in chat). The
console does not become the IdP.

---

## Not this

- DDoS / slowloris / filling the disk. Login backoff is anti-guess, not
  anti-flood. In-memory; restart resets the counters.
- A WAN-open console. Login does not make that a good idea.
- SSO, OIDC, email, invite links, “forgot password.”
- HaveIBeenPwned / zxcvbn. Offline denylist + structure checks.
- CSRF tokens. Cookie is `SameSite=Lax`, APIs are same-origin.
- Hiding `/login` and `/setup` HTML. Those pages are public; the data is
  not.
- A twelve-role RBAC product. Three named roles is the door.

---

## Operator checklist

1. First boot: `/setup` with a real passphrase before the LAN URL is a
   habit for anyone else on the network.
2. Home LAN: compose `:80` is OK *behind* login. Cloud:
   `GANTREE_LISTEN=127.0.0.1` + Tailscale or tunnel. No cloud firewall
   hole. Partner keys: **user** on that crane, not a shared admin login.
   Public hostname: `compose.cloudflare.yml` (recommended) or
   `compose.nginx.yml`.
3. Never set `GANTREE_DEV` in compose.
4. Forgot passphrase → delete yard sqlite → setup. There is no other
   recovery.
5. Partner leaves → **Settings** (cog) → remove them. Their sessions dies.
6. Agents: still no inbound ports. Do not add any.

Tests for the door live in `test/yard/door/door.test.ts` (setup, login
errors, backoff, passphrase rejects, session drop on change).
