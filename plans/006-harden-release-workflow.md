# Plan 006: Publish to the stores only from a tag that passed every CI check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- .github/ docs/publication.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / security
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz is published to the Chrome Web Store and Firefox Add-ons (AMO) by `.github/workflows/release.yml` when a
`vX.Y.Z` tag is pushed. That workflow runs only the tests before uploading: no format check, lint, typecheck,
knip, Firefox build or `web-ext lint` — which CI (`ci.yml`) does run, but the release does not wait for CI, and a
tag can point at any commit. An AMO rejection is only learnt after submission and costs a version bump. The
workflow can also be started by hand (`workflow_dispatch`) from any branch, and then **skips** the
tag-matches-version check while still submitting with the store credentials. `contents: write` is granted to the
whole workflow, and actions are referenced by movable tags in the job that holds the store secrets.

After this plan: the release job runs only after the full CI job succeeded on the same commit, only on tags,
with write permission only where needed, and with actions pinned to commit SHAs kept fresh by Dependabot.

## Current state

- `.github/workflows/ci.yml` — triggers `push: branches: [main]` and `pull_request`; one job `check` running:
  checkout, `pnpm/action-setup@v6`, `actions/setup-node@v7` (node 24, pnpm cache), `pnpm install --frozen-lockfile`,
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `pnpm vitest run`, `pnpm build`,
  `pnpm build:firefox`, `pnpm lint:firefox`. No `permissions:` block.

- `.github/workflows/release.yml` (lines 1–30 shown; the rest zips, runs `pnpm wxt submit` with
  `CHROME_*`/`FIREFOX_*` secrets from `secrets.*`, then `gh release create` when `github.ref_type == 'tag'`):

  ```yaml
  on:
    push:
      tags: ["v*.*.*"]
    workflow_dispatch:

  permissions:
    contents: write

  jobs:
    release:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v7
        - uses: pnpm/action-setup@v6
        - uses: actions/setup-node@v7
          with:
            node-version: 24
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm vitest run

        - name: Check tag matches package.json version
          if: github.ref_type == 'tag'
          run: test "v$(node -p 'require("./package.json").version')" = "$GITHUB_REF_NAME"
  ```

- `docs/publication.md` (French) step 3 describes the workflow; it does not mention manual runs.
- `.github/` has `ISSUE_TEMPLATE/` and `workflows/`; no `dependabot.yml`.
- **Never** copy secret values anywhere; only secret _names_ appear in workflow files.

## Commands you will need

| Purpose       | Command                                                                                                                                                           | Expected on success |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| YAML parses   | `node -e "const y=require('yaml');for (const f of ['ci','release']) y.parse(require('fs').readFileSync('.github/workflows/'+f+'.yml','utf8'));console.log('ok')"` | prints `ok`         |
| Look up a SHA | `gh api repos/actions/checkout/commits/v7 --jq .sha`                                                                                                              | a 40-char SHA       |
| Format check  | `pnpm format:check`                                                                                                                                               | exit 0              |

(`yaml` is present in `node_modules`; if `require('yaml')` fails, use `js-yaml` with `.load`.)

## Scope

**In scope**:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/dependabot.yml` (create)
- `docs/publication.md` (one sentence)

**Out of scope**:

- Any `secrets.*` name or the `wxt submit` arguments.
- GitHub repository settings (Environments with reviewers, branch protection): these are done in the GitHub UI by
  the maintainer; mention them in your report, do not attempt them.

## Git workflow

- Branch: `ci/harden-release`. Commit e.g. `ci: release only after the full checks, from a tag`.
- Pre-commit hook runs lint-staged (Prettier on yml), typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Make CI reusable

In `ci.yml`, add `workflow_call:` under `on:` and a top-level `permissions: { contents: read }`.

**Verify**: YAML parse command → `ok`.

### Step 2: Release = CI, then publish

Rewrite the top of `release.yml`:

```yaml
on:
  push:
    tags: ["v*.*.*"]

permissions:
  contents: read

jobs:
  check:
    uses: ./.github/workflows/ci.yml

  release:
    needs: check
    runs-on: ubuntu-latest
    permissions:
      contents: write # the GitHub release with the zips
    steps:
      …checkout / pnpm / node / install as before…
      - name: Check tag matches package.json version
        run: test "v$(node -p 'require("./package.json").version')" = "$GITHUB_REF_NAME"
      …zip, submit, gh release unchanged…
```

- Remove `workflow_dispatch`.
- Remove the `pnpm vitest run` step from `release` (the `check` job ran it).
- Remove `if: github.ref_type == 'tag'` from the version check and the GitHub release step (only tags trigger now).
- Update the header comment: `# Push a tag vX.Y.Z (matching package.json's version): the CI checks run, then both stores get it.`

**Verify**: YAML parse → `ok`; `grep -n "workflow_dispatch\|ref_type" .github/workflows/release.yml` → nothing.

### Step 3: Pin actions to commit SHAs

For each `uses:` with a tag (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`) in **both**
workflows, look up the SHA with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` and write
`uses: actions/checkout@<sha> # v7`. Leave `uses: ./.github/workflows/ci.yml` as is.

**Verify**: `grep -nE "uses: [^.].*@v[0-9]" .github/workflows/*.yml` → nothing; every external `uses:` line has a
40-hex SHA and a `# vN` comment.

### Step 4: Keep the pins fresh

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
```

**Verify**: `node -e "require('yaml').parse(require('fs').readFileSync('.github/dependabot.yml','utf8'));console.log('ok')"` → `ok`.

### Step 5: Docs

In `docs/publication.md` step 3, start the sentence with: « Le workflow `.github/workflows/release.yml` relance
d'abord toutes les vérifications de la CI, puis vérifie… » (French, matching the file).

**Verify**: `pnpm format:check` → exit 0.

## Test plan

No unit tests apply. Verification is YAML validity plus the greps above. The real proof is the next tag push:
the `check` job must appear before `release` in the Actions run.

## Done criteria

- [ ] `release.yml` has no `workflow_dispatch`, a `check` job using `./.github/workflows/ci.yml`, `release` with `needs: check`
- [ ] Top-level `permissions: contents: read` in both workflows; `contents: write` only on the `release` job
- [ ] No external action referenced by tag (grep in Step 3)
- [ ] `.github/dependabot.yml` exists
- [ ] `pnpm format:check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The maintainer relies on manual runs (e.g. `docs/` or a script mentions running the release by hand): report;
  the alternative is keeping `workflow_dispatch` restricted with `if: github.ref == 'refs/heads/main'` and running the
  version check unconditionally.
- `gh` cannot reach the network to resolve SHAs: do Steps 1, 2, 4, 5 and report Step 3 as blocked.
- A `secrets.*` reference would need to move or change.

## Maintenance notes

- Recommend to the maintainer (GitHub UI, not code): put the store secrets in a GitHub **Environment** (e.g.
  `stores`) with a required reviewer and add `environment: stores` to the `release` job; enable tag protection
  for `v*`.
- Dependabot will open PRs bumping the SHAs; review them like any dependency bump.
- If CI gains a step that needs secrets, reusable workflows need `secrets: inherit` on the `check` job.
