#!/usr/bin/env bash
# Puts one version of the site online: `./deploy.sh <tag>`, run on the VPS by .github/workflows/deploy.yml once the
# images ghcr.io/achaak/optizzz-{web,tools}:<tag> are pushed. Migrations first, then the site's rights, then the site.
set -euo pipefail
cd "$(dirname "$0")"

# One at a time with the hourly ingest and the backup (ingest.sh, backup.sh): an ingest started during the pull
# brought the previous tools image back on a disk that does not hold two, and a migration waits on its transaction.
exec 9>.lock
flock -w 2400 9 || { echo "Another task still holds the lock after 40 minutes." >&2; exit 1; }

tag="${1:?usage: deploy.sh <tag>}"
compose() { docker compose --profile tools "$@"; }

# Every image but the new version's goes before the pull: the disk (17 GB) does not hold two tools images of 2.4 GB
# (deploy of 2026-11-12, « no space left on device »). The online site's web image stays, its container running
# (docker rmi refuses it); the online tools image runs in no container.
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/achaak/optizzz-' | grep -v ":$tag\$" |
  xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null

# Downloaded before .env names them: until then, the hourly ingest (ingest.sh) keeps the images it has.
TAG="$tag" compose pull --quiet web tools
# The tag stays in .env: the hourly ingest runs the same version as the site.
{ grep -v '^TAG=' .env || true; echo "TAG=$tag"; } >.env.new
cat .env.new >.env && rm .env.new

compose up -d --wait db
compose run --rm tools pnpm db:deploy
compose exec -T db psql -U optizzz -d optizzz -v ON_ERROR_STOP=1 --quiet <postgres/grants.sql
compose up -d --wait --remove-orphans web caddy
# The Caddyfile is mounted as a file: a new one copied by the deployment is not read until Caddy reloads it, and
# « up » leaves a container whose service did not change running as it was.
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

# The image's pages were prerendered on an empty database: rebuilt at their next visit.
compose run --rm --no-deps tools sh -c \
  'wget -qO- --header "authorization: Bearer $REVALIDATE_SECRET" --post-data "" "$SITE_URL/api/revalidate"'
echo

# The previous versions' images (2.4 GB for tools): the disk holds only a few of them.
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/achaak/optizzz-' | grep -v ":$tag\$" |
  xargs -r docker rmi >/dev/null || true
docker image prune -f >/dev/null
echo "Optizzz $tag is online."
