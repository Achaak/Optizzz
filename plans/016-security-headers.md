# Plan 016: The site answers with the basic security headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- deploy/Caddyfile`
> If the file changed since this plan was written, compare the "Current state" excerpt against the live file
> before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site optizzz.fr has accounts, sessions and pages where a member's private key is used in the browser
(`/account`, `/spaces/…`). It is served by Caddy in front of a Next.js server, and neither sets any security
header: no HSTS, no `X-Content-Type-Options`, nothing against being shown inside another site's frame. A page
of the account can therefore be framed by any site (clickjacking), and a first visit over `http://` is only
protected by Caddy's redirect. After this plan, every answer of the site carries four standard headers.

## Current state

- `deploy/Caddyfile` (whole file, indented with tabs):

  ```
  # HTTPS for optizzz.fr (Let's Encrypt certificates, renewed by Caddy). No access log: the site keeps no IP address.
  optizzz.fr {
  	encode zstd gzip
  	reverse_proxy web:3000
  }

  www.optizzz.fr {
  	redir https://optizzz.fr{uri} permanent
  }
  ```

- `apps/web/next.config.js` sets no `headers()`. Leave it that way: one place for the headers.
- The image is `caddy:2.10-alpine` (`deploy/compose.yml:52`).
- Nothing frames the site: the browser extension opens the site's tools in a new tab, and the dialog it draws
  over the game (`apps/extension/src/utils/page-dialog.ts`) frames the extension's own pages only. The site's
  ads (Google AdSense) are frames **inside** the site's pages, which these headers do not affect.
- The Caddyfile is copied to the VPS and applied by the next deployment (`.github/workflows/deploy.yml`, then
  `deploy/deploy.sh`: `compose up -d --wait --remove-orphans web caddy`).

## Commands you will need

| Purpose                     | Command                                                                                                                                                 | Expected on success             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Validate (needs Docker)     | `docker run --rm -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` | ends with `Valid configuration` |
| Format check (needs Docker) | `docker run --rm -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10-alpine caddy fmt --diff /etc/caddy/Caddyfile`                            | no output                       |
| Repo format                 | `pnpm format:check`                                                                                                                                     | exit 0                          |

## Scope

**In scope**:

- `deploy/Caddyfile`

**Out of scope**:

- A `Content-Security-Policy`: the site loads Google AdSense and inline scripts (`apps/web/src/app/layout.tsx`);
  a policy that does not break them needs its own design and a report-only period.
- `apps/web/next.config.js`, `deploy/compose.yml`.
- `includeSubDomains` and `preload` on HSTS: they bind every present and future sub-domain, a decision for the owner.

## Git workflow

- Branch: `fix/security-headers`.
- One commit, e.g. `fix(deploy): HSTS, nosniff, no framing and a referrer policy on the site`.
- Never `--no-verify`. Do not push: a push to `main` that touches `deploy/` deploys.

## Steps

### Step 1: Check that nothing frames the site

**Verify**: `grep -rn "optizzz.fr" apps/extension/src/utils/page-dialog.ts` → no match (the dialog frames
extension pages only). A match is a STOP condition.

### Step 2: Add the headers

In `deploy/Caddyfile`, inside the `optizzz.fr { … }` block, between `encode zstd gzip` and `reverse_proxy web:3000`,
add (tabs for indentation, like the rest of the file):

```
	# HTTPS only for a year; no guessing of content types; never inside another site's frame (the account and the
	# Espaces d'alliance); the path of a page is not told to other sites.
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
```

Leave the `www.optizzz.fr` block unchanged.

**Verify**: `grep -c "Strict-Transport-Security\|X-Content-Type-Options\|X-Frame-Options\|Referrer-Policy" deploy/Caddyfile` → `4`.

### Step 3: Validate

Run the two Docker commands of the table.

**Verify**: `Valid configuration`, and no diff from `caddy fmt`. If Docker is not available, say so in your
report: the file is then only checked by the grep of step 2.

### Step 4: Gate

**Verify**: `pnpm format:check` → exit 0. `git status --short` → only `deploy/Caddyfile`.

## Test plan

No automated test covers the Caddyfile. After the deployment that carries this change, the owner checks:
`curl -sI https://optizzz.fr/ | grep -i -E "strict-transport|x-content-type|x-frame|referrer-policy"` → four lines.

## Done criteria

- [ ] The four headers are in the `optizzz.fr` block of `deploy/Caddyfile`
- [ ] `caddy validate` reports a valid configuration (or the report says Docker was unavailable)
- [ ] Only `deploy/Caddyfile` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 finds the site framed by the extension.
- `caddy validate` fails on the added block after one correction attempt.
- The Caddyfile already has a `header` directive.

## Maintenance notes

- `X-Frame-Options: DENY` forbids every framing of the site, the site framing itself included. If a page of
  the site must one day be shown in a frame (a preview, an embed of the map), replace it with
  `Content-Security-Policy "frame-ancestors 'self'"` for that case.
- HSTS is remembered by browsers for a year: the site can no longer be served over plain HTTP during that time.
  That is already how it runs (Caddy redirects to HTTPS).
- The AdSense script is loaded on every page of the site, the Espaces d'alliance included
  (`apps/web/src/app/layout.tsx`). A Content-Security-Policy, and whether that script should load at all on the
  pages where keys are used, is an open decision recorded in `plans/README.md`.
