#!/usr/bin/env bash
# The site's hourly cron (docs/features/site-public.md), started by systemd (systemd/optizzz-ingest.timer): reads every
# server's public exports, then asks the site to rebuild its pages. By hand, for one server: `./ingest.sh --server s5`.
set -euo pipefail
cd "$(dirname "$0")"

docker compose --profile tools run --rm tools pnpm ingest ${1:+-- "$@"}
