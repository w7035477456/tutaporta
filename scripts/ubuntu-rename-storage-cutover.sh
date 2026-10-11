#!/usr/bin/env bash
# Ubuntu one-shot: rename the storage folders and flip everything that points at them.
#   /mnt/pgdata16/onlinemallwebsite_storage            -> tutamallStorageFolder_outdatedOct2021
#   /mnt/pgdata16/onlinemallwebsite_largecheapstorage  -> tutamallStorageFolder_largecheapstorage_outdatedOct2021
#
# Steps: sudo mv both folders (parent is root-owned), update FAST_STORAGE_FOLDER /
# LARGE_CHEAP_STORAGE_FOLDER in ~/.ssh/be/.env, rewrite stored paths in Postgres
# (be/db/renameStorageFolderPathsTutamallOutdatedOct2021.sql), update ~/b, restart PM2.
# If the DB update fails, folders and .env are rolled back.
#
# Run on Ubuntu as lawsen0 (asks for sudo once):
#   bash ~/ubuntu-rename-storage-cutover.sh
set -euo pipefail

ROOT="${STORAGE_ROOT:-/mnt/pgdata16}"
OLD_FAST="$ROOT/onlinemallwebsite_storage"
NEW_FAST="$ROOT/tutamallStorageFolder_outdatedOct2021"
OLD_LC="$ROOT/onlinemallwebsite_largecheapstorage"
NEW_LC="$ROOT/tutamallStorageFolder_largecheapstorage_outdatedOct2021"
SQL="${STORAGE_RENAME_SQL:-$HOME/renameStorageFolderPathsTutamallOutdatedOct2021.sql}"
ENVF="$HOME/.ssh/be/.env"
PM2_APP="tutamallPM2Process"
STAMP="$(date +%Y%m%d%H%M%S)"

[[ -d "$OLD_FAST" && -d "$OLD_LC" ]] || { echo "ERROR: old folders not found under $ROOT (already renamed?)" >&2; exit 1; }
[[ ! -e "$NEW_FAST" && ! -e "$NEW_LC" ]] || { echo "ERROR: new folder name already exists under $ROOT" >&2; exit 1; }
[[ -r "$SQL" ]] || { echo "ERROR: missing $SQL" >&2; exit 1; }

cd "$HOME/code/main"
# shellcheck source=lib/pg-env.sh
. scripts/lib/pg-env.sh
pg_load_connection_defaults

sudo -v

cp -p "$ENVF" "$ENVF.bak-before-storagerename-$STAMP"
cp -p "$HOME/b" "$HOME/b.bak-before-storagerename-$STAMP"

echo "=== 1/5 move folders"
sudo mv "$OLD_FAST" "$NEW_FAST"
sudo mv "$OLD_LC" "$NEW_LC"

rollback() {
  echo "!!! rolling back folders and .env" >&2
  sudo mv "$NEW_FAST" "$OLD_FAST" || true
  sudo mv "$NEW_LC" "$OLD_LC" || true
  cp -p "$ENVF.bak-before-storagerename-$STAMP" "$ENVF"
}

echo "=== 2/5 update ~/.ssh/be/.env"
perl -i -pe 's/onlinemallwebsite_largecheapstorage/tutamallStorageFolder_largecheapstorage_outdatedOct2021/g if /^\s*(export\s+)?LARGE_CHEAP_STORAGE_FOLDER\s*=/; s/onlinemallwebsite_storage/tutamallStorageFolder_outdatedOct2021/g if /^\s*(export\s+)?FAST_STORAGE_FOLDER\s*=/' "$ENVF"
chmod --reference="$ENVF.bak-before-storagerename-$STAMP" "$ENVF"
echo "FAST_STORAGE_FOLDER=$(pg_read_env FAST_STORAGE_FOLDER)"
echo "LARGE_CHEAP_STORAGE_FOLDER=$(pg_read_env LARGE_CHEAP_STORAGE_FOLDER)"

echo "=== 3/5 rewrite stored paths in Postgres ($PGDATABASE)"
if ! psql -X -v ON_ERROR_STOP=1 -f "$SQL"; then
  rollback
  exit 1
fi

echo "=== 4/5 update ~/b"
perl -i -pe 's/onlinemallwebsite_largecheapstorage/tutamallStorageFolder_largecheapstorage_outdatedOct2021/g; s/onlinemallwebsite_storage/tutamallStorageFolder_outdatedOct2021/g' "$HOME/b"

echo "=== 5/5 restart PM2 ($PM2_APP)"
pm2 restart "$PM2_APP" --update-env >/dev/null
code=000
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:40000/api/health || true)"
  [[ "$code" == 200 ]] && break
  sleep 1
done

echo "--- verify"
ls -ld "$NEW_FAST" "$NEW_LC"
touch "$NEW_FAST/photos/.write_test" && rm "$NEW_FAST/photos/.write_test" && echo "write test OK"
psql -X -At -c "SELECT 'old paths left: ' || (
  (SELECT count(*) FROM outdateddbsnapshotoct2024.photos WHERE file_path LIKE '%onlinemallwebsite\_%') +
  (SELECT count(*) FROM outdateddbsnapshotoct2024.videos WHERE file_path LIKE '%onlinemallwebsite\_%') +
  (SELECT count(*) FROM outdateddbsnapshotoct2024.vault_cluster_state WHERE mount_path LIKE '%onlinemallwebsite\_%'));"
echo "~/b old refs left: $(grep -c 'onlinemallwebsite_' "$HOME/b" || true)"
pm2 logs "$PM2_APP" --lines 200 --nostream 2>/dev/null | grep -E "storage folder perms|media storage" | tail -2
echo "health: $code"
[[ "$code" == 200 ]] && echo "DONE" || { echo "WARNING: health is $code — check: pm2 logs $PM2_APP" >&2; exit 1; }
