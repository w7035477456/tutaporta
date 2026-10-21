#!/usr/bin/env bash
# xbox1 192.168.202.201 — HAProxy + Nginx + Postgres PRIMARY
# Run ON xbox1 from the repo checkout:
#   cd ~/code/main/configSetup/twoServers/DBPrimary-Haproxy && sudo ./install.sh
# Prereqs (one time): sudo apt install haproxy nginx postgresql-16
#   and copy the TLS cert from xbox2 /etc/haproxy/certs/site.pem → xbox1 /etc/haproxy/certs/site.pem (secret; not in git).
set -euo pipefail
cd "$(dirname "$0")"

[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
for bin in haproxy nginx; do
  command -v "$bin" >/dev/null || { echo "Missing $bin — sudo apt install haproxy nginx postgresql-16"; exit 1; }
done
[[ -d /etc/postgresql/16/main ]] || { echo "Missing Postgres 16 — sudo apt install postgresql-16"; exit 1; }
[[ -s /etc/haproxy/certs/site.pem ]] || { echo "Missing /etc/haproxy/certs/site.pem — copy it from xbox2 first"; exit 1; }

TS=$(date +%Y%m%d%H%M%S)
put() { # put <src> <dest> <mode>
  if [[ -f "$2" ]] && ! cmp -s "$1" "$2"; then cp -p "$2" "$2.bak-$TS"; fi
  install -m "$3" "$1" "$2"
}

echo "== HAProxy"
put haproxy.cfg            /etc/haproxy/haproxy.cfg            644
put cloudflare-ips-v4.txt  /etc/haproxy/cloudflare-ips-v4.txt  644
put cloudflare-ips-v6.txt  /etc/haproxy/cloudflare-ips-v6.txt  644
haproxy -c -f /etc/haproxy/haproxy.cfg
systemctl enable --now haproxy
systemctl reload haproxy

echo "== Nginx"
put nginx.conf                 /etc/nginx/nginx.conf                 644
put sites-available/default    /etc/nginx/sites-available/default    644
put sites-available/protected  /etc/nginx/sites-available/protected  644
ln -sf /etc/nginx/sites-available/default   /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/protected /etc/nginx/sites-enabled/protected
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== Postgres PRIMARY"
put postgresql.conf /etc/postgresql/16/main/postgresql.conf 644
put pg_hba.conf     /etc/postgresql/16/main/pg_hba.conf     640
chown postgres:postgres /etc/postgresql/16/main/postgresql.conf /etc/postgresql/16/main/pg_hba.conf
# wal_level / max_wal_senders need a restart, not a reload.
systemctl restart postgresql
sudo -u postgres psql -p 50010 -v ON_ERROR_STOP=1 -f setupPrimaryReplication.sql
if [[ "$(sudo -u postgres psql -p 50010 -Atc "SELECT rolpassword IS NULL FROM pg_authid WHERE rolname='replicator'")" == "t" ]]; then
  echo "Set the replicator password (you will type it again on xbox3 in setupReplica.sh):"
  sudo -u postgres psql -p 50010 -c "\password replicator"
fi

echo "== Firewall"
install -m 755 setupufw /usr/local/bin/setupufw
/usr/local/bin/setupufw

echo "== Done. Check: curl -s -o /dev/null -w '%{http_code}\n' http://192.168.202.203:40000/health"
echo "   HAProxy stats: http://192.168.202.201:9900/stats"
