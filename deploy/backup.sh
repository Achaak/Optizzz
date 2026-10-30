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

mkdir -p backups
file="backups/optizzz-$(date -u +%Y-%m-%dT%H%MZ).dump"
docker compose exec -T db pg_dump -U optizzz -d optizzz --format=custom >"$file.part"
mv "$file.part" "$file"
find backups -name '*.dump' -mtime +7 -delete

if [[ -n "${BACKUP_BUCKET:-}" ]]; then
  export RCLONE_CONFIG_SCW_TYPE=s3 RCLONE_CONFIG_SCW_PROVIDER=Scaleway RCLONE_CONFIG_SCW_REGION=fr-par \
    RCLONE_CONFIG_SCW_ENDPOINT=s3.fr-par.scw.cloud \
    RCLONE_CONFIG_SCW_ACCESS_KEY_ID="$SCW_ACCESS_KEY" RCLONE_CONFIG_SCW_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
  rclone copy "$file" "scw:$BACKUP_BUCKET/"
  rclone delete --min-age 30d "scw:$BACKUP_BUCKET/"
fi
echo "Backup: $file"
