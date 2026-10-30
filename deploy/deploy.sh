#!/usr/bin/env bash
# Puts one version of the site online: `./deploy.sh <tag>`, run on the VPS by .github/workflows/deploy.yml once the
# images ghcr.io/achaak/optizzz-{web,tools}:<tag> are pushed. Migrations first, then the site's rights, then the site.
set -euo pipefail
cd "$(dirname "$0")"

tag="${1:?usage: deploy.sh <tag>}"
# The tag stays in .env: the hourly ingest (ingest.sh) runs the same version as the site.
{ grep -v '^TAG=' .env || true; echo "TAG=$tag"; } >.env.new
cat .env.new >.env && rm .env.new

compose() { docker compose --profile tools "$@"; }

compose pull --quiet web tools
compose up -d --wait db
compose run --rm tools pnpm db:deploy
compose exec -T db psql -U optizzz -d optizzz -v ON_ERROR_STOP=1 --quiet <postgres/grants.sql
compose up -d --wait --remove-orphans web caddy

# The image's pages were prerendered on an empty database: rebuilt at their next visit.
compose run --rm --no-deps tools sh -c \
  'wget -qO- --header "authorization: Bearer $REVALIDATE_SECRET" --post-data "" "$SITE_URL/api/revalidate"'
echo

docker image prune -f >/dev/null
echo "Optizzz $tag is online."
