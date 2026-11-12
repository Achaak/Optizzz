# Plan 011: A deployment, the hourly ingest and the backup never run at the same time

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- deploy/deploy.sh deploy/ingest.sh deploy/backup.sh deploy/systemd/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site runs on one small VPS (2 GB of memory, 17 GB of disk) with three shell scripts in `/opt/optizzz`:
`deploy.sh` (run over SSH by GitHub Actions), `ingest.sh` (systemd timer, every hour at ten past) and
`backup.sh` (systemd timer, 03:40 UTC). Nothing stops them from overlapping. A deployment that lands while the
ingest runs can pull the previous 2.4 GB image back while the new one downloads — the "no space left on
device" failure of 2026-11-12, which `deploy.sh` itself notes in a comment — or run database migrations while
the ingest holds a transaction of several minutes on the same tables. Separately, a backup that fails leaves
its partial dump on disk forever, and the backup unit has no timeout. After this plan the three scripts take
one lock, a failed backup cleans up after itself, and a hung backup is stopped.

## Current state

- `deploy/deploy.sh` (37 lines). Start of the file:

  ```bash
  #!/usr/bin/env bash
  # Puts one version of the site online: `./deploy.sh <tag>`, run on the VPS by .github/workflows/deploy.yml once the
  # images ghcr.io/achaak/optizzz-{web,tools}:<tag> are pushed. Migrations first, then the site's rights, then the site.
  set -euo pipefail
  cd "$(dirname "$0")"

  tag="${1:?usage: deploy.sh <tag>}"
  compose() { docker compose --profile tools "$@"; }

  # Every image but the new version's goes before the pull: the disk (17 GB) does not hold two tools images of 2.4 GB
  # (deploy of 2026-11-12, « no space left on device »). The online site's web image stays, its container running
  # (docker rmi refuses it); the online tools image runs in no container: an hourly ingest started meanwhile pulls it back.
  docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/achaak/optizzz-' | grep -v ":$tag\$" |
    xargs -r docker rmi >/dev/null 2>&1 || true
  ```

- `deploy/ingest.sh` (whole file):

  ```bash
  #!/usr/bin/env bash
  # The site's hourly cron (docs/features/site-public.md), started by systemd (systemd/optizzz-ingest.timer): reads every
  # server's public exports, then asks the site to rebuild its pages. By hand, for one server: `./ingest.sh --server s5`.
  set -euo pipefail
  cd "$(dirname "$0")"

  docker compose --profile tools run --rm tools pnpm ingest ${1:+-- "$@"}
  ```

- `deploy/backup.sh:26-33`:

  ```bash
  trap record EXIT

  mkdir -p backups
  dump="backups/optizzz-$(date -u +%Y-%m-%dT%H%MZ).dump"
  docker compose exec -T db pg_dump -U optizzz -d optizzz --format=custom >"$dump.part"
  mv "$dump.part" "$dump"
  file="$dump" bytes=$(stat -c %s "$dump")
  find backups -name '*.dump' -mtime +7 -delete
  ```

  The purge only matches `*.dump`: a `.part` left by a failed `pg_dump` is never removed.

- `deploy/systemd/optizzz-backup.service` — `[Service]` has `Type=oneshot`, `User=optizzz`,
  `ExecStart=/opt/optizzz/backup.sh` and no timeout. `deploy/systemd/optizzz-ingest.service` has
  `TimeoutStartSec=30min`.
- The three scripts run as the same user (`optizzz`) from the same directory (`/opt/optizzz`), on Linux, where
  `flock` (util-linux) is installed. The deploy workflow copies `deploy/systemd` to `/opt/optizzz/systemd` at
  each deployment but does **not** install the units into `/etc/systemd/system`: only `scripts/setup-vps.sh:362`
  does, by hand.
- Conventions: `set -euo pipefail`, variables quoted, comments in English that say why.

## Commands you will need

| Purpose      | Command                                                         | Expected on success                                |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------- |
| Shell syntax | `bash -n deploy/deploy.sh deploy/ingest.sh deploy/backup.sh`    | exit 0, no output                                  |
| ShellCheck   | `shellcheck deploy/deploy.sh deploy/ingest.sh deploy/backup.sh` | no new warning (skip if not installed, and say so) |
| Format       | `pnpm format:check`                                             | exit 0                                             |

You cannot run these scripts on a development machine (no VPS, and macOS has no `flock`). Do not try to
connect to the VPS.

## Scope

**In scope**:

- `deploy/deploy.sh`
- `deploy/ingest.sh`
- `deploy/backup.sh`
- `deploy/systemd/optizzz-backup.service`

**Out of scope**:

- `deploy/compose.yml`, `deploy/Caddyfile`, `.github/workflows/deploy.yml`, `scripts/setup-vps.sh`.
- Shrinking the tools image, memory limits, encrypting backups: separate decisions.
- The order of the steps inside `deploy.sh`.

## Git workflow

- Branch: `fix/deploy-ingest-backup-lock`.
- One commit, e.g. `fix(deploy): one lock for the deployment, the ingest and the backup`.
- Never `--no-verify`. Do not push: a push to `main` that touches `deploy/` deploys.

## Steps

### Step 1: The lock in `deploy.sh`

Right after `cd "$(dirname "$0")"`, add:

```bash
# One at a time with the hourly ingest and the backup (ingest.sh, backup.sh): an ingest started during the pull
# brought the previous tools image back on a disk that does not hold two, and a migration waits on its transaction.
exec 9>.lock
flock -w 2400 9 || { echo "Another task still holds the lock after 40 minutes." >&2; exit 1; }
```

Then shorten the comment above the first `docker images` line: remove its last clause
(`: an hourly ingest started meanwhile pulls it back`), which is no longer true, so the sentence ends with
`the online tools image runs in no container.`

**Verify**: `bash -n deploy/deploy.sh` → exit 0. `grep -n "pulls it back" deploy/deploy.sh` → no match.

### Step 2: The ingest skips while the lock is held

In `deploy/ingest.sh`, between `cd` and the `docker compose` line:

```bash
# Never during a deployment or a backup (deploy.sh): this pass is skipped, the next one catches up.
exec 9>.lock
flock -n 9 || { echo "A deployment, a backup or another ingest is running: skipped."; exit 0; }
```

**Verify**: `bash -n deploy/ingest.sh` → exit 0.

### Step 3: The backup waits for the lock and cleans up

In `deploy/backup.sh`:

1. After `mkdir -p backups`, add:

   ```bash
   # After the ingest or a deployment under way (deploy.sh), never with them.
   exec 9>.lock
   flock -w 3000 9
   # What a failed run left: a partial dump is not a backup, and the purge below only knows *.dump.
   rm -f backups/*.part
   ```

2. Leave the rest unchanged. A `flock` that times out exits non-zero, which the existing `trap record EXIT`
   records as a failed run at step `pg_dump`.

In `deploy/systemd/optizzz-backup.service`, add as the last line of `[Service]`:

```ini
TimeoutStartSec=1h
```

**Verify**: `bash -n deploy/backup.sh` → exit 0.
`grep -c "flock" deploy/deploy.sh deploy/ingest.sh deploy/backup.sh` → 1 for each file.
`grep -n "TimeoutStartSec" deploy/systemd/*.service` → two lines.

### Step 4: Gate

**Verify**: `pnpm format:check` → exit 0 (Prettier does not format `.sh`; this only confirms nothing else moved).
`git status --short` → only the four in-scope files.

## Test plan

No automated test exists for the deployment scripts, and this plan adds none: the checks are `bash -n`,
ShellCheck where installed, and the greps above. The first real run is the next deployment; see Maintenance notes.

## Done criteria

- [ ] `bash -n deploy/deploy.sh deploy/ingest.sh deploy/backup.sh` exits 0
- [ ] Each of the three scripts opens `.lock` on descriptor 9 and calls `flock` once
- [ ] `deploy/systemd/optizzz-backup.service` has `TimeoutStartSec=1h`
- [ ] Only the four in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- A script already takes a lock, or its start differs from the excerpts.
- ShellCheck reports an error (not a style note) on a line you added.
- You are tempted to run a script or to SSH anywhere to try it: do not.

## Maintenance notes

- **Operator step after the merge**: the new backup timeout only applies once the unit is installed again, as
  root on the VPS: `install -m 644 /opt/optizzz/systemd/* /etc/systemd/system/ && systemctl daemon-reload`.
- A deployment pushed while the ingest runs now waits for it (a few minutes, 40 at most) inside the GitHub
  Actions job instead of racing it.
- If systemd stops `ingest.sh` at its 30-minute timeout, the lock is released while the container may still be
  running: `docker ps` shows it. That was already true before this plan.
- An ingest skipped because of the lock writes nothing to the back office (`JobRun`): an hour without a line
  there, at the time of a deployment, is expected.
