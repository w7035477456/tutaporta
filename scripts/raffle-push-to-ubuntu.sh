#!/usr/bin/env bash
# Copy Mac raffle_host, raffle_event and raffle_user rows to Ubuntu Primary (Mac wins).
#   raffle_host / raffle_event: same ids, inserted or overwritten (incl. host_password_hash; lockout reset).
#   raffle_user: members are matched by singles.email (singles_id differs per box); upserted on
#                (singles_id, event_id), so a Mac ticket replaces that member's Ubuntu ticket for the event.
#                Skipped (with a notice) when the member is not on Ubuntu or the number / code is already
#                used by another Ubuntu member. Ubuntu-only rows are never deleted.
# A CSV backup of Ubuntu's three tables is written to ~/raffle_ubuntu_backup_<time>.csv first.
#
#   scripts/raffle-push-to-ubuntu.sh            # show counts, ask, then copy
#   scripts/raffle-push-to-ubuntu.sh --yes      # no prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S=outdateddbsnapshotoct2024
UB="$SCRIPT_DIR/ubuntu-psql.sh"

mac_sql() { psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -X "$@"; }

echo "Mac rows to push:"
mac_sql -c "SELECT (SELECT count(*) FROM $S.raffle_host) AS hosts,
                   (SELECT count(*) FROM $S.raffle_event) AS events,
                   (SELECT count(*) FROM $S.raffle_user) AS tickets;"

if [[ "${1:-}" != --yes ]]; then
  read -r -p "Push them to Ubuntu (Mac wins on conflicts)? (y/N): " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled, nothing copied."; exit 1; }
fi

backup="$HOME/raffle_ubuntu_backup_$(date +%Y%m%d_%H%M%S).csv"
{
  for t in raffle_host raffle_event raffle_user; do
    echo "## $t"
    "$UB" -c "COPY (SELECT * FROM $S.$t ORDER BY 1) TO STDOUT WITH CSV HEADER"
  done
} > "$backup"
chmod 600 "$backup"
echo "Ubuntu backup: $backup"

statements="$(mac_sql -At -c "
SELECT format('INSERT INTO $S.raffle_host (raffle_host_id, host_full_name, host_email, host_phone, host_url, host_password_hash, host_failed_attempts, host_locked_until)
  VALUES (%s, %L, %L, %L, %L, %L, 0, NULL)
  ON CONFLICT (raffle_host_id) DO UPDATE SET host_full_name = EXCLUDED.host_full_name, host_email = EXCLUDED.host_email,
    host_phone = EXCLUDED.host_phone, host_url = EXCLUDED.host_url, host_password_hash = EXCLUDED.host_password_hash,
    host_failed_attempts = 0, host_locked_until = NULL;',
  raffle_host_id, host_full_name, host_email, host_phone, host_url, host_password_hash)
  FROM $S.raffle_host
UNION ALL
SELECT format('INSERT INTO $S.raffle_event (event_id, event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime, event_build_n_address, host_event_raffle_start, host_event_raffle_end, event_time_zone)
  VALUES (%s, %L, %s, %L, %L, %L, %L, %L, %L, %L)
  ON CONFLICT (event_id) DO UPDATE SET event_show_combo = EXCLUDED.event_show_combo, raffle_host_id = EXCLUDED.raffle_host_id,
    event_title = EXCLUDED.event_title, event_url = EXCLUDED.event_url, event_night_datetime = EXCLUDED.event_night_datetime,
    event_build_n_address = EXCLUDED.event_build_n_address, host_event_raffle_start = EXCLUDED.host_event_raffle_start,
    host_event_raffle_end = EXCLUDED.host_event_raffle_end, event_time_zone = EXCLUDED.event_time_zone;',
  event_id, event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime,
  event_build_n_address, host_event_raffle_start, host_event_raffle_end, event_time_zone)
  FROM $S.raffle_event
UNION ALL
SELECT format(\$f\$DO \$do\$ DECLARE sid integer; BEGIN
  SELECT singles_id INTO sid FROM $S.singles WHERE lower(email) = lower(%L) ORDER BY singles_id LIMIT 1;
  IF sid IS NULL THEN RAISE NOTICE 'SKIP Mac ticket %s (#%s, event %s): member %s not on Ubuntu'; RETURN; END IF;
  BEGIN
    INSERT INTO $S.raffle_user (singles_id, raffle_host_id, event_id, raffle_number, raffle_generated_id, raffle_generate_datetime, raffle_win, raffle_claimed,
      raffle_claimed_datetime, paypal_info, venmo_info, raffle_prize_paid, raffle_prize_paid_datetime)
    VALUES (sid, %s, %s, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)
    ON CONFLICT (singles_id, event_id) DO UPDATE SET raffle_host_id = EXCLUDED.raffle_host_id, raffle_number = EXCLUDED.raffle_number,
      raffle_generated_id = EXCLUDED.raffle_generated_id, raffle_generate_datetime = EXCLUDED.raffle_generate_datetime,
      raffle_win = EXCLUDED.raffle_win, raffle_claimed = EXCLUDED.raffle_claimed,
      raffle_claimed_datetime = EXCLUDED.raffle_claimed_datetime, paypal_info = EXCLUDED.paypal_info, venmo_info = EXCLUDED.venmo_info,
      raffle_prize_paid = EXCLUDED.raffle_prize_paid, raffle_prize_paid_datetime = EXCLUDED.raffle_prize_paid_datetime;
    RAISE NOTICE 'OK   Mac ticket %s (#%s, event %s) -> Ubuntu singles_id %%', sid;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'SKIP Mac ticket %s (#%s, event %s): number or code already used by another Ubuntu member';
  END;
END \$do\$;\$f\$,
  s.email,
  u.raffle_user_id, coalesce(u.raffle_number::text, '-'), u.event_id, coalesce(s.email, 'singles_id ' || u.singles_id),
  u.raffle_host_id, u.event_id, u.raffle_number, u.raffle_generated_id, u.raffle_generate_datetime, u.raffle_win, u.raffle_claimed,
  u.raffle_claimed_datetime, u.paypal_info, u.venmo_info, u.raffle_prize_paid, u.raffle_prize_paid_datetime,
  u.raffle_user_id, coalesce(u.raffle_number::text, '-'), u.event_id,
  u.raffle_user_id, coalesce(u.raffle_number::text, '-'), u.event_id)
  FROM $S.raffle_user u
  LEFT JOIN $S.singles s ON s.singles_id = u.singles_id;")"

{
  echo "BEGIN;"
  printf '%s\n' "$statements"
  echo "SELECT setval(pg_get_serial_sequence('$S.raffle_host', 'raffle_host_id'), (SELECT max(raffle_host_id) FROM $S.raffle_host));"
  echo "SELECT setval(pg_get_serial_sequence('$S.raffle_event', 'event_id'), (SELECT max(event_id) FROM $S.raffle_event));"
  echo "SELECT setval(pg_get_serial_sequence('$S.raffle_user', 'raffle_user_id'), (SELECT max(raffle_user_id) FROM $S.raffle_user));"
  echo "COMMIT;"
} | "$UB" -q 2>&1 | grep -E 'NOTICE|ERROR|FATAL|DETAIL' | sed 's/^.*NOTICE:  //'

echo
echo "Ubuntu raffle rows now:"
"$UB" -c "SELECT 'host' AS kind, raffle_host_id AS id, host_full_name AS info, (host_password_hash IS NOT NULL) AS has_password FROM $S.raffle_host
          UNION ALL SELECT 'event', event_id, left(event_title, 45), event_show_combo FROM $S.raffle_event
          ORDER BY 1 DESC, 2;"
"$UB" -c "SELECT u.raffle_user_id, u.singles_id, s.email, u.event_id, u.raffle_number, u.raffle_generated_id, u.raffle_win, u.raffle_claimed
            FROM $S.raffle_user u LEFT JOIN $S.singles s ON s.singles_id = u.singles_id ORDER BY u.event_id, u.raffle_user_id;"
