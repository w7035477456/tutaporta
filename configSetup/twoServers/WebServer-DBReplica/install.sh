#!/usr/bin/env bash
# xbox3 192.168.202.203 — Node/PM2 FE&BE :40000 + Postgres REPLICA + Redis
# Run ON xbox3 from the repo checkout (after setupReplica.sh has run once):
#   cd ~/code/main/configSetup/twoServers/WebServer-DBReplica && sudo ./install.sh
# Re-run any time these configs change. App deploy itself is still work2 / work2_deploy.
set -euo pipefail
cd "$(dirname "$0")"

[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
[[ -d /etc/postgresql/16/main ]] || { echo "Missing Postgres 16 — sudo apt install postgresql-16"; exit 1; }
[[ -f /var/lib/postgresql/16/main/standby.signal ]] || { echo "Not a replica yet — run sudo ./setupReplica.sh first"; exit 1; }

TS=$(date +%Y%m%d%H%M%S)
put() { # put <src> <dest> <mode>
  if [[ -f "$2" ]] && ! cmp -s "$1" "$2"; then cp -p "$2" "$2.bak-$TS"; fi
  install -m "$3" -o postgres -g postgres "$1" "$2"
}

echo "== Postgres REPLICA"
put postgresql.conf /etc/postgresql/16/main/postgresql.conf 644
put pg_hba.conf     /etc/postgresql/16/main/pg_hba.conf     640
systemctl restart postgresql
sudo -u postgres psql -p 50010 -Atc "SELECT 'in_recovery=' || pg_is_in_recovery()"

echo "== Redis (local only; the BE uses REDIS_URL=redis://127.0.0.1:6379)"
command -v redis-server >/dev/null || apt-get install -y redis-server
systemctl enable --now redis-server

echo "== Firewall"
install -m 755 setupufw /usr/local/bin/setupufw
/usr/local/bin/setupufw

echo "== Done. Next: put BE env per beEnvChanges.txt, then work2_deploy and pm2 restart tutamallPM2Process"
