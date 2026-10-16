#!/usr/bin/env bash
# Copy raffle_host + raffle_event rows that exist on Mac Postgres but not on Ubuntu Primary.
# Keeps the same ids (so event ↔ host links stay intact); rows whose id already exists on Ubuntu
# are left untouched. raffle_user is NOT copied — those are member tickets tied to each box's singles.
#
#   scripts/raffle-push-to-ubuntu.sh            # show what would be copied, ask, then copy
#   scripts/raffle-push-to-ubuntu.sh --yes      # no prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S=outdateddbsnapshotoct2024

mac_sql() { psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -X "$@"; }

ub_hosts="$("$SCRIPT_DIR/ubuntu-psql.sh" -At -c "SELECT coalesce(string_agg(raffle_host_id::text, ','), '0') FROM $S.raffle_host;")"
ub_events="$("$SCRIPT_DIR/ubuntu-psql.sh" -At -c "SELECT coalesce(string_agg(event_id::text, ','), '0') FROM $S.raffle_event;")"

echo "Mac rows missing on Ubuntu:"
mac_sql -c "SELECT 'host' AS kind, raffle_host_id AS id, host_full_name AS name FROM $S.raffle_host
             WHERE raffle_host_id NOT IN ($ub_hosts)
            UNION ALL
            SELECT 'event', event_id, event_title FROM $S.raffle_event
             WHERE event_id NOT IN ($ub_events)
            ORDER BY 1 DESC, 2;"

count="$(mac_sql -At -c "SELECT (SELECT count(*) FROM $S.raffle_host WHERE raffle_host_id NOT IN ($ub_hosts))
                              + (SELECT count(*) FROM $S.raffle_event WHERE event_id NOT IN ($ub_events));")"
if [[ "$count" == 0 ]]; then echo "Nothing to copy — Ubuntu already has every Mac host and event."; exit 0; fi

if [[ "${1:-}" != --yes ]]; then
  read -r -p "Copy these $count row(s) to Ubuntu? (y/N): " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled, nothing copied."; exit 1; }
fi

inserts="$(mac_sql -At -c "
SELECT format('INSERT INTO $S.raffle_host (raffle_host_id, host_full_name, host_email, host_phone, host_url) VALUES (%s, %L, %L, %L, %L) ON CONFLICT (raffle_host_id) DO NOTHING;',
              raffle_host_id, host_full_name, host_email, host_phone, host_url)
  FROM $S.raffle_host WHERE raffle_host_id NOT IN ($ub_hosts)
UNION ALL
SELECT format('INSERT INTO $S.raffle_event (event_id, event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime, event_build_n_address, host_event_raffle_start, host_event_raffle_end, event_time_zone) VALUES (%s, %L, %s, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (event_id) DO NOTHING;',
              event_id, event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime,
              event_build_n_address, host_event_raffle_start, host_event_raffle_end, event_time_zone)
  FROM $S.raffle_event WHERE event_id NOT IN ($ub_events);")"

{
  echo "BEGIN;"
  printf '%s\n' "$inserts" | grep 'INSERT INTO .*raffle_host '  || true
  printf '%s\n' "$inserts" | grep 'INSERT INTO .*raffle_event ' || true
  echo "SELECT setval(pg_get_serial_sequence('$S.raffle_host', 'raffle_host_id'), (SELECT max(raffle_host_id) FROM $S.raffle_host));"
  echo "SELECT setval(pg_get_serial_sequence('$S.raffle_event', 'event_id'), (SELECT max(event_id) FROM $S.raffle_event));"
  echo "COMMIT;"
} | "$SCRIPT_DIR/ubuntu-psql.sh" -q

echo "Ubuntu raffle events now:"
"$SCRIPT_DIR/ubuntu-psql.sh" -c "SELECT event_id, raffle_host_id, event_title, event_time_zone, event_show_combo FROM $S.raffle_event ORDER BY event_id;"
