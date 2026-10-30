#!/bin/sh
# Run once, when the database is created (an empty volume): the site's role. Its rights come from grants.sql, at each
# deployment, once the migrations have created the schemas and their tables.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE optizzz_app WITH LOGIN PASSWORD :'app_password';
SQL
