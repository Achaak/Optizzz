#!/usr/bin/env bash
# Takes back, once, the hourly moves and probable floods of the last 30 days (docs/features/site-analyse.md, « Reprise »).
# Long on S4 (44 MB an export): run it in the background, `nohup ./backfill.sh > backfill.log 2>&1 &`. One server:
# `./backfill.sh --server s5`. It runs beside the hourly cron (no lock): an hour already written is skipped.
set -euo pipefail
cd "$(dirname "$0")"

docker compose --profile tools run --rm tools pnpm backfill ${1:+-- "$@"}
