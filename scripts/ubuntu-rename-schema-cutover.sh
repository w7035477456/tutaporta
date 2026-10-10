#!/usr/bin/env bash
# One-time Ubuntu cutover: helloworldjunktest → outdateddbsnapshotoct2024.
# Run from the Mac IMMEDIATELY after deploying the branch that uses the new name:
#
#   deployall2 && ~/code/main/scripts/ubuntu-rename-schema-cutover.sh
#
# 1) Renames the schema + fixes function bodies + role search_path (be/db/renameSchemaToOutdatedDbSnapshotOct2024.sql)
# 2) Ubuntu ~/.ssh/be/.env: DB_SCHEMA / VSINGLES_SCHEMA (backup: .env.bak-schema-rename)
# 3) Ubuntu ~/b: replaces the schema name in place (backup: ~/b.bak-schema-rename; keeps local-only edits)
# 4) pm2 reload tutamallPM2Process, then checks the API and table count.
# Safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST="${UBUNTU_SSH_HOST:-lawsen0@192.168.222.202}"

echo "=== 1/4 rename schema on Ubuntu Postgres ==="
"$SCRIPT_DIR/ubuntu-psql.sh" -f "$REPO/be/db/renameSchemaToOutdatedDbSnapshotOct2024.sql"

echo "=== 2-4/4 Ubuntu env, ~/b, pm2 reload ==="
"$SCRIPT_DIR/deploy-ssh-mac.sh" -o ConnectTimeout=25 "$HOST" 'set -e
ENV=$HOME/.ssh/be/.env
[ -f "$ENV.bak-schema-rename" ] || cp -p "$ENV" "$ENV.bak-schema-rename"
perl -pi -e "s/^(DB_SCHEMA|VSINGLES_SCHEMA)=helloworldjunktest\s*\$/\$1=outdateddbsnapshotoct2024\n/" "$ENV"
grep -nE "^(DB_SCHEMA|VSINGLES_SCHEMA)=" "$ENV"
[ -f "$HOME/b.bak-schema-rename" ] || cp -p "$HOME/b" "$HOME/b.bak-schema-rename"
perl -pi -e "s/helloworldjunktest/outdateddbsnapshotoct2024/gi" "$HOME/b"
bash -n "$HOME/b" && echo "~/b updated: old refs left=$(grep -ci helloworldjunktest "$HOME/b" || true)"
pm2 reload tutamallPM2Process --update-env >/dev/null || pm2 restart tutamallPM2Process --update-env >/dev/null
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:40000/api/publicConfig || true)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "API /api/publicConfig HTTP $code"
pm2 jlist 2>/dev/null | grep -o "\"name\":\"tutamallPM2Process\"[^}]*\"status\":\"[a-z]*\"" | grep -o "\"status\":\"[a-z]*\"" | sort | uniq -c'

echo "=== verify ==="
"$SCRIPT_DIR/ubuntu-psql.sh" -At -c "SELECT 'tables in outdateddbsnapshotoct2024: ' || count(*) FROM pg_tables WHERE schemaname = 'outdateddbsnapshotoct2024'; SELECT 'singles: ' || count(*) FROM outdateddbsnapshotoct2024.singles;"
echo "Cutover done. Now run: isdbsame"
