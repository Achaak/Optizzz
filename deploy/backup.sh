#!/usr/bin/env bash
# The database's daily backup (systemd/optizzz-backup.timer): a pg_dump kept 7 days on the VPS and 30 days in a Scaleway
# Object Storage bucket (BACKUP_BUCKET and its keys in .env; unset, the copy stays on the VPS only).
# Restore: `docker compose exec -T db pg_restore -U optizzz -d optizzz --clean --if-exists < backups/<file>.dump`.
set -euo pipefail
cd "$(dirname "$0")"
set -a
# shellcheck source=/dev/null
. ./.env
set +a

# Each run goes to the back office (docs/features/site-back-office.md): what was kept, where, or which step failed.
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
file="" bytes="" copied="" step="pg_dump"
record() {
  local status=$? ok=false error="$step"
  if [[ $status -eq 0 ]]; then ok=true error=""; fi
  docker compose exec -T db psql -q -U optizzz -d optizzz -v ON_ERROR_STOP=1 -v started="$started" -v ok="$ok" \
    -v file="$file" -v bytes="$bytes" -v copied="$copied" -v error="$error" <<'SQL' || echo "Could not record the run" >&2
INSERT INTO "JobRun" (job, "startedAt", "endedAt", ok, report)
VALUES ('backup', :'started', now() AT TIME ZONE 'UTC', :'ok', json_build_object(
  'file', NULLIF(:'file', ''), 'bytes', NULLIF(:'bytes', '')::bigint, 'copied', NULLIF(:'copied', '')::boolean,
  'error', NULLIF(:'error', '')));
SQL
}
trap record EXIT

mkdir -p backups
dump="backups/optizzz-$(date -u +%Y-%m-%dT%H%MZ).dump"
docker compose exec -T db pg_dump -U optizzz -d optizzz --format=custom >"$dump.part"
mv "$dump.part" "$dump"
file="$dump" bytes=$(stat -c %s "$dump")
find backups -name '*.dump' -mtime +7 -delete

if [[ -n "${BACKUP_BUCKET:-}" ]]; then
  step="rclone" copied=false
  export RCLONE_CONFIG_SCW_TYPE=s3 RCLONE_CONFIG_SCW_PROVIDER=Scaleway RCLONE_CONFIG_SCW_REGION=fr-par \
    RCLONE_CONFIG_SCW_ENDPOINT=s3.fr-par.scw.cloud \
    RCLONE_CONFIG_SCW_ACCESS_KEY_ID="$SCW_ACCESS_KEY" RCLONE_CONFIG_SCW_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
  rclone copy "$file" "scw:$BACKUP_BUCKET/"
  copied=true step="rclone delete"
  rclone delete --min-age 30d "scw:$BACKUP_BUCKET/"
fi
echo "Backup: $file"
