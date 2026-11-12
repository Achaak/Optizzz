# Plan 019: The shadcn CLI is a development dependency of the site

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/web/package.json`
> If the file changed since this plan was written, compare the "Current state" excerpt against the live file
> before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

`pnpm audit --prod` reports 14 advisories on this repository, 5 of them high. Every path shown goes through
`apps/web > shadcn`: the command-line tool that writes the site's UI components, listed among the site's
runtime `dependencies`. Nothing imports it at runtime; the site only reads one stylesheet from it while
building. As long as it sits in `dependencies`, the audit of what really runs in production is drowned in the
tool's own dependency tree, and a real advisory would not stand out. Moving it to `devDependencies` makes
`pnpm audit --prod` say what production runs.

## Current state

- `apps/web/package.json`: `"shadcn": "^4.22.1"` at line 39, inside `"dependencies"` (which starts at line 17);
  `"devDependencies"` starts at line 45. Both lists are in alphabetical order.
- The only use of the package in the site's sources: `apps/web/src/styles/globals.css:3`,
  `@import "shadcn/tailwind.css";`, resolved when the site is built.
- `knip.json` already lists `shadcn` in `ignoreDependencies` for `apps/web`: leave it.
- The site's Docker image (`apps/web/Dockerfile`) installs with
  `pnpm install --frozen-lockfile --filter "@optizzz/web..."`, development dependencies included, then builds;
  the image that runs only holds the build's output. So a development dependency is present at build time.
- The package manager is pnpm 12 (`"packageManager": "pnpm@12.3.4"` in the root `package.json`), Node 24.

## Commands you will need

| Purpose                               | Command                            | Expected on success              |
| ------------------------------------- | ---------------------------------- | -------------------------------- |
| Install                               | `pnpm install`                     | exit 0, `pnpm-lock.yaml` updated |
| Audit                                 | `pnpm audit --prod`                | no path through `shadcn`         |
| Typecheck                             | `pnpm typecheck`                   | exit 0                           |
| Lint                                  | `pnpm lint`                        | exit 0                           |
| Dead code                             | `pnpm knip`                        | no new finding                   |
| Tests                                 | `pnpm vitest run`                  | all pass                         |
| Site build (needs the local database) | `pnpm --filter @optizzz/web build` | exit 0                           |

The site's build reads a database: start the local one first
(`cd apps/web && cp -n .env.example .env && docker compose up -d && pnpm exec prisma migrate deploy && cd ../..`).

## Scope

**In scope**:

- `apps/web/package.json`
- `pnpm-lock.yaml`

**Out of scope**:

- Upgrading `shadcn` or any other package: the version stays `^4.22.1`.
- `apps/web/src/components/ui/` (written by the shadcn CLI, never edited by hand).
- `knip.json`, `apps/web/Dockerfile`.

## Git workflow

- Branch: `chore/shadcn-dev-dependency`.
- One commit, e.g. `chore(web): the shadcn CLI is a development dependency`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: Record the audit before

**Verify**: `pnpm audit --prod 2>&1 | tail -3` → note the line `N vulnerabilities found` and the severities.
`pnpm audit --prod 2>&1 | grep -c "shadcn"` → a number above 0.

### Step 2: Move the line

In `apps/web/package.json`, remove `"shadcn": "^4.22.1",` from `"dependencies"` and add it to
`"devDependencies"` at its alphabetical place. Then run `pnpm install`.

**Verify**: `git diff --stat` → only `apps/web/package.json` and `pnpm-lock.yaml`.
`grep -n '"shadcn"' apps/web/package.json` → one line, after the line `"devDependencies": {`.

### Step 3: The audit after

**Verify**: `pnpm audit --prod 2>&1 | grep -c "shadcn"` → `0`. Note the new total for your report.

### Step 4: Nothing else moved

**Verify**: `pnpm typecheck && pnpm lint && pnpm knip && pnpm vitest run` → exit 0.
With the local database running, `pnpm --filter @optizzz/web build` → exit 0 (this proves the stylesheet import
still resolves). Without Docker, say in your report that the build was left to CI.

## Test plan

No new test. The site's build is the check that `@import "shadcn/tailwind.css"` still resolves.

## Done criteria

- [ ] `shadcn` is listed once in `apps/web/package.json`, under `devDependencies`
- [ ] `pnpm audit --prod` shows no path through `shadcn`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm vitest run` exit 0
- [ ] Only `apps/web/package.json` and `pnpm-lock.yaml` are modified
- [ ] `plans/README.md` status row updated, with the audit totals before and after

## STOP conditions

- `pnpm install` changes the version of any package other than moving `shadcn` between the two lists (check
  `git diff pnpm-lock.yaml | grep "^[-+]" | grep -v shadcn | head`): report instead of committing an upgrade.
- A `.ts` or `.tsx` file outside `apps/web/src/components/ui/` imports from `shadcn`
  (`grep -rn "from \"shadcn" apps/web/src --include="*.ts" --include="*.tsx"`).
- The site's build fails on the stylesheet import.

## Maintenance notes

- Advisories that remain in `pnpm audit --prod` after this plan are about packages production really runs:
  read them one by one.
- If a future shadcn component needs a runtime helper from the `shadcn` package itself (not from `cn` or
  `@base-ui/react`), it goes back to `dependencies`.
