#!/usr/bin/env bash
# Puts one version of the site online: `./deploy.sh <tag>`, run on the VPS by .github/workflows/deploy.yml once the
# images ghcr.io/achaak/optizzz-{web,tools}:<tag> are pushed. Migrations first, then the site's rights, then the site.
set -euo pipefail
cd "$(dirname "$0")"

tag="${1:?usage: deploy.sh <tag>}"
compose() { docker compose --profile tools "$@"; }

# Downloaded before .env names them: until then, the hourly ingest (ingest.sh) keeps the images it has.
TAG="$tag" compose pull --quiet web tools
# The tag stays in .env: the hourly ingest runs the same version as the site.
{ grep -v '^TAG=' .env || true; echo "TAG=$tag"; } >.env.new
cat .env.new >.env && rm .env.new

compose up -d --wait db
compose run --rm tools pnpm db:deploy
compose exec -T db psql -U optizzz -d optizzz -v ON_ERROR_STOP=1 --quiet <postgres/grants.sql
compose up -d --wait --remove-orphans web caddy

# The image's pages were prerendered on an empty database: rebuilt at their next visit.
compose run --rm --no-deps tools sh -c \
  'wget -qO- --header "authorization: Bearer $REVALIDATE_SECRET" --post-data "" "$SITE_URL/api/revalidate"'
echo

# The previous versions' images (2.4 GB for tools): the disk holds only a few of them.
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/achaak/optizzz-' | grep -v ":$tag\$" |
  xargs -r docker rmi >/dev/null || true
docker image prune -f >/dev/null
echo "Optizzz $tag is online."
