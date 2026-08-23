# Custom MCP servers

The Tools grid is the **yard catalog** (search, math, maps, …). A custom
server is still a first-class grant: it is a `[[server]]` in that crane’s
`mcp.toml`. There is no `/mcp/add?url=` route.

Chat stays Telegram. Gantree only writes files and runs `gantry tools-fetch`.

---

## A. Build one — clone an existing MCP

Do not start from a blank Go module. Fork or copy a sibling that already
speaks stdio, ships a static binary, and prints **shape**.

| You need | Clone this | Why |
| --- | --- | --- |
| No secrets | [mcp-go-math](https://github.com/shotah/mcp-go-math) | Smallest: evaluate + convert, empty `env_keys` |
| One API key | [google-maps-mcp](https://github.com/shotah/google-maps-mcp) | `host-manifest` + `GOOGLE_MAPS_API_KEY` |
| OAuth hop | [go-strava-mcp](https://github.com/shotah/go-strava-mcp) | `auth_args` + PKCE paste (`url` / `exchange`) |

Keep:

- `CGO_ENABLED=0` static binary, stdio MCP only
- Root `package main` so `go run . host-manifest` works
- Tool names `{service}_{verb}_{object}` with **no** server id in the tool
  ([ai-gantry naming](https://github.com/shotah/ai-gantry/blob/main/docs/mcp-naming.md))
- GoReleaser archive: `{command}_{version}_{os}_{arch}.tar.gz`

Rename `name` / `command` / tool prefixes. Do not reuse `maps` or `math`.

### `host-manifest` (required)

The binary must exit 0 and print one JSON object on stdout:

```bash
CGO_ENABLED=0 go run . host-manifest
```

```json
{
  "name": "rentals",
  "command": "rentals-search-mcp",
  "env_keys": ["RENTCAST_API_KEY"],
  "blurb": "US listings. One RentCast key."
}
```

Optional fields: `args`, `auth_args`, `auth_flow` (`pkce` | `device` | `mfa`),
`home_only`, `download_url`, `download_tag`. First arg `host-manifest` must
not start the stdio server.

If the tool needs a browser hop, implement the same auth argv as
[ai-gantry auth.md](https://github.com/shotah/ai-gantry/blob/main/docs/auth.md)
and set `auth_args` (e.g. `["auth"]`). Static keys stay in `.env` — never
`/auth rentals <apikey>`.

Publish a GitHub release so `tools-fetch` can GET the tarball.

---

## B. Define it for gantree

Hand-edit **that crane’s** `gantries/<slug>/mcp.toml`. Listed = granted.

```toml
[[server]]
name = "rentals"
command = "rentals-search-mcp"
download_tag = "latest"
download_url = "https://github.com/you/rentals-search-mcp/releases/download/{tag}/rentals-search-mcp_{version}_{os}_{arch}.tar.gz"
# auth_args = ["auth"]   # only if the binary has an OAuth/login hop
```

Placeholders in `download_url`: `{tag}` `{version}` `{os}` `{arch}`.
`download_tag = "latest"` only works when the URL is
`https://github.com/<owner>/<repo>/…`.

Then on the crane dashboard:

1. Put required keys in the crane `.env` (secrets form only lists catalog
   `env_keys`; for a custom server, type them in `.env` or we add the package
   to the yard list)
2. **recreate** — fetches bins into `/data/bin`, prunes leftovers not in
   `mcp.toml`, reloads MCP (`PATH` includes `/data/bin`). The tools-fetch
   button is the same install, without reload.

Doctor / skip hints follow missing env and `auth_args`.

### Yard catalog (optional)

The toggle grid reads `lib/yard/tools/packages.ts`. Add a row there if this yard
should offer the server to every crane (name, `command`, GitHub
`downloadUrl`, clone `repo` for `go run . host-manifest`). Shape still
comes from the binary. Do not hardcode `env_keys` in gantree.

Until that row exists, User B’s MCP will not appear as a checkbox — only
as a `[[server]]` you wrote.
