# leanpub-mcp

An MCP server for the [Leanpub author API](https://leanpub.com/help/api) —
preview, publish, royalties, coupons, readers.

## Why this exists

Leanpub documents an official hosted MCP server at
`https://leanpub.com/api/mcp`. As of 2026-09-14 that endpoint 404s on every
method (GET/POST/HEAD/OPTIONS), despite the docs describing it as live
("very early beta"). This is a local stdio server that talks to the same
documented REST API directly, so preview/publish workflows aren't blocked
on Leanpub finishing their rollout. Drop it once `leanpub.com/api/mcp`
actually answers.

## Setup

```bash
npm install
```

### API key

Requires a **Pro plan** API key from https://leanpub.com/account/api_key.
Resolved fresh on every tool call (never cached), checked in this order:

1. `LEANPUB_API_KEY` env var (literal key)
2. `LEANPUB_API_KEY_FILE` env var (path to a file containing the key)
3. `.leanpub-api-key` in the current working directory
4. `~/.config/leanpub/api_key`

Writing the key to a file takes effect on the very next tool call — no
server restart needed.

### Register with Claude Code

As a personal, cross-project tool (recommended — keeps the machine-specific
path out of any repo's committed `.mcp.json`):

```bash
claude mcp add --scope user --transport stdio leanpub -- node /absolute/path/to/leanpub-mcp/bin/leanpub-mcp.js
```

Or add to a specific project's `.mcp.json`:

```json
{
  "mcpServers": {
    "leanpub": {
      "command": "node",
      "args": ["/absolute/path/to/leanpub-mcp/bin/leanpub-mcp.js"]
    }
  }
}

### MCP client timeout for `wait_for_job`

`wait_for_job` polls internally for up to `timeoutSeconds` (default 120),
but that's a single MCP tool call the whole time -- most MCP clients kill a
tool call after their own default request timeout (often 30s) regardless of
what the server is doing internally, since this server sends no progress
notifications. Confirmed live: a 180s `wait_for_job` call was killed at 30s
with `Request timeout after 30000ms` even though the underlying Leanpub job
finished fine.

Fix: set a per-server timeout in your MCP client config, comfortably above
whatever `timeoutSeconds` you pass. In Claude Code / OMP's `.mcp.json`:

```json
{
  "mcpServers": {
    "leanpub": {
      "command": "node",
      "args": ["/absolute/path/to/leanpub-mcp/bin/leanpub-mcp.js"],
      "timeout": 300000
    }
  }
}
```

Without that, just poll `get_job_status` directly in a loop (5s between
calls, per Leanpub's own rate-limit guidance) instead of calling
`wait_for_job`.

## Tools

| Tool | Leanpub endpoint |
|---|---|
| `verify_api_key` | `GET /current_user.json` |
| `get_book` | `GET /{slug}.json` |
| `check_book_exists` | `GET /{slug}/exists.json` |
| `create_book` | `POST /books.json` |
| `create_bundle` | `POST /bundles.json` |
| `create_course` | `POST /courses.json` |
| `create_track` | `POST /tracks.json` |
| `preview_book` | `POST /{slug}/preview.json` |
| `preview_subset` | `POST /{slug}/preview/subset.json` |
| `preview_single` | `POST /{slug}/preview/single.json` |
| `publish_book` | `POST /{slug}/publish.json` |
| `unpublish_book` | `POST /{slug}/unpublish.json` |
| `retire_book` | `POST /{slug}/retire.json` |
| `close_book` | `POST /{slug}/close.json` |
| `get_job_status` | `GET /{slug}/job_status.json` |
| `wait_for_job` | polls `get_job_status` every 5s until complete or timeout |
| `get_royalties` | `GET /{slug}/royalties.json` |
| `get_individual_purchases` | `GET /{slug}/individual_purchases.json` |
| `list_coupons` / `get_coupon` / `create_coupon` / `update_coupon` | `/{slug}/coupons[.json/{code}.json]` |
| `get_user_reader_emails` / `get_book_reader_emails` | `/reader_emails.json` |
| `register_interest` / `get_interested_readers` | `/{slug}/interested*.json` |
| `preview_course` / `publish_course` | `/c/{...}/preview.json`, `/c/{...}/publish.json` |

Not implemented: file upload to `upload`-mode books, XML response formats
(JSON only). Add them if you need them — `src/client.js` follows one
pattern per resource.

## Typical workflow

> Preview the book, then tell me when it's ready.

Calls `preview_book`, then `wait_for_job`, then reports the `pdf_preview_url`
/ `epub_preview_url` from a follow-up `get_book` call.

## Testing

```bash
npm test          # unit tests for URL building, error parsing, key resolution
```

Unit tests don't hit the network. To confirm the server is wired to the
real API, run `verify_api_key` with a real (or intentionally wrong) key and
check you get back a `200` with your username, or a clean `401`.
