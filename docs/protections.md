# Cloudflare protections

Recommended Cloudflare settings when Gantree is published with
[`compose.cloudflare.yml`](../compose.cloudflare.yml). These controls live
in the Cloudflare dashboard (Zero Trust and WAF), not in the compose
file. `cloudflared` only maintains the outbound tunnel.

Stand the hostname up first: [install.md](install.md). Gantree’s own
login, backoff, and roles: [security.md](security.md). Agents still
open **zero** inbound ports — protect the console hostname, not the
cranes.

---

## Recommendations

| Priority | Setting | Why |
| --- | --- | --- |
| **Recommended** | [Cloudflare Access](#cloudflare-access) on the public hostname, with **Protect with Access** on the tunnel | Unauthenticated traffic never reaches the origin |
| **Recommended** | [WAF rate limit](#rate-limit-login) on `POST /api/login` and `/api/setup` | Login hashing is expensive; a spray can stall a small host |
| **Recommended** | [Bot Fight Mode](#bot-fight-mode) | Challenges known automated clients |
| **Recommended** | Keep WAN ports closed; on a cloud VM set `GANTREE_LISTEN=127.0.0.1` | The tunnel is bypassed if 80/443 are forwarded on the router or cloud firewall |
| Optional | [Security level High](#optional-waf-settings), country or ASN allowlists | Useful when operators only sign in from a known region |
| Incident only | [Under Attack Mode](#under-attack-mode) | JS-challenge every request while an attack is underway |

Access plus a login rate-limit is the stack we recommend for a personal
or household console. The optional rows are extra.

---

## What the tunnel already provides

| Layer | Effect |
| --- | --- |
| Cloudflare Tunnel | Outbound-only connection. No public origin IP and no WAN ports to publish. |
| Proxied hostname | Traffic is already on Cloudflare’s DDoS path. |
| Gantree login backoff | After 8 failed attempts per name (or 40 globally) in 15 minutes, login returns `429` for 15 minutes. Unknown names get the same error; a dummy hash runs so timing is not a tell. |

Backoff is in-memory and clears on process restart. It slows guessing; it
does not absorb a flood. Each login attempt still runs on the origin
after Cloudflare forwards the request.

On first boot, whoever posts `/api/setup` first owns the yard. Finish
setup before the hostname is a habit. Access blocks that path from the
public Internet; it does not replace care on a LAN port.

---

## Cloudflare Access

**Recommended.** Cloudflare Zero Trust → **Access** → **Applications** →
add a **self-hosted** application for the same public hostname as the
tunnel.

Create an **Allow** policy for the operators’ email addresses (or a
domain you control). Use an identity provider you already have (Google,
GitHub, or one-time PIN). Session lifetime can be days; Gantree `/login`
still runs after Access.

Then Zero Trust → **Networks** → **Tunnels** → the public hostname →
enable **Protect with Access**. `cloudflared` rejects requests that do
not present an Access cookie, so the origin never sees a bare
`POST /api/login` from the Internet.

Access on the Zero Trust free plan is enough for a small operator list.
A partner who only updates keys is still a **user** on that crane after
both gates — [operators.md](operators.md).

Visitors will see two prompts: Cloudflare, then Gantree. That is
intentional. Access is the Internet gate; Gantree’s passphrase is who
may operate the yard. Do not disable the yard login because Access is
on.

---

## Rate-limit login

**Recommended.** Security → **WAF** → **Rate limiting rules**. On plans
with a small rule quota, spend it here:

| | |
| --- | --- |
| When | `POST` and URI path `/api/login` (include `/api/setup` in the same rule if possible) |
| Rate | 5–10 requests per 10 seconds per IP |
| Action | **Managed Challenge**, then Block if the client continues |

Without Access, this is the control that keeps login hashing off the
host. With Access, it still catches anything that slipped past.

Dashboard labels change; the intent does not: limit **POSTs to login
and setup**, not every static GET.

---

## Bot Fight Mode

**Recommended.** Security → **Bots** → **Bot Fight Mode**. Issues a
challenge to clients that match known bot patterns. It is included on
the free plan.

If a device you use cannot complete the challenge, turn Bot Fight Mode
off. Access is the stronger control.

On a paid plan with **Super Bot Fight Mode**, keep **Definitely
Automated** set to **Allow**. Blocking that class can break the tunnel
websocket handshake (`websocket: bad handshake`).

---

## Optional WAF settings

**Security level High** (Security → **Settings**) challenges
low-reputation IPs. Reasonable for an operator console.

The **WAF Free Managed Ruleset** is already enabled on proxied
hostnames. It helps against common probes, not a focused login spray.

**Country or ASN custom rules** are reasonable when every operator
signs in from one region. Challenge or block the rest. Skip this if
people travel without a VPN plan.

---

## Under Attack Mode

**Incident only.** Enables a JavaScript challenge on every request.
Turn it on while the hostname is under a Layer 7 flood; turn it off
afterward. It is a poor daily default, especially on phones.

Volumetric attacks against the origin IP are what the tunnel already
removes. This switch is for application-layer load on the hostname.

---

## Compose and bind

Rate limits, challenges, and Access are dashboard settings. Extra
`cloudflared` `command:` flags, retries, or image pins in
`compose.cloudflare.yml` do not rate-limit clients. Keep
`TUNNEL_TOKEN` as documented in [install.md](install.md).

Use either `compose.cloudflare.yml` **or** `compose.nginx.yml`, not
both.

Do not forward 80/443 on the router or open a cloud firewall port “as
a backup.” That path bypasses Cloudflare.

---

## How the layers combine

| Layer | What it stops |
| --- | --- |
| Tunnel | Direct-to-IP floods and open WAN ports |
| Access + Protect with Access | Unauthenticated Internet traffic |
| WAF rate limit on `POST /api/login` | Remaining login spray before origin hashing |
| Bot Fight Mode / security level | Scripted probes |
| Gantree backoff | Password guessing that still reaches the app |
| Under Attack Mode | An active Layer 7 incident |

---

## Not recommended

- Treating compose flags as a WAF. There is no WAF in
  `compose.cloudflare.yml`.
- fail2ban on the origin for tunnel traffic. The host sees
  `cloudflared`, not the client IP. Limits belong at Cloudflare.
- nginx in front of the tunnel. The tunnel exists so the origin does
  not terminate public TLS.
- A Pro plan unless Super Bot Fight analytics are needed. Access and
  one rate-limit rule are the recommended personal setup.
- Hiding `/login` HTML. The page is public; the data is not
  ([security.md](security.md)).
- Skipping first-boot `/setup` on the LAN because Access is enabled
  on the public hostname.
