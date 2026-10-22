#!/usr/bin/env bash
# Raffle prize admin (raffle_user): list winners, mark a prize paid, set a claim time.
#
#   raffle-prize.sh list                         [local|ubuntu|both]   # verified winners (raffle_status) + PayPal/Venmo + paid
#   raffle-prize.sh paid    <CODE>               [local|ubuntu|both]   # CLAIMED -> PAID (raffle_prize_paid = true, paid time = now)
#   raffle-prize.sh unpaid  <CODE>               [local|ubuntu|both]   # undo paid
#   raffle-prize.sh claimed <CODE> '<datetime>'  [local|ubuntu|both]   # set raffle_claimed_datetime
#
# CODE = the ticket's verification code, with or without the dash (V4JB-GHKH or V4JBGHKH).
# Default target: local (the Postgres of this machine). "ubuntu" / "both" only work from the Mac.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S=outdateddbsnapshotoct2024

usage() { sed -n '2,10p' "$0"; exit 1; }

local_sql() { psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -X "$@"; }
ubuntu_sql() { "$SCRIPT_DIR/ubuntu-psql.sh" "$@"; }

run_sql() {
  local target="$1" sql="$2"
  case "$target" in
    local) local_sql -c "$sql" ;;
    ubuntu) ubuntu_sql -c "$sql" ;;
    both)
      echo "== Mac =="; local_sql -c "$sql"
      echo "== Ubuntu =="; ubuntu_sql -c "$sql" ;;
    *) echo "Unknown target '$target' (use local, ubuntu or both)." >&2; exit 1 ;;
  esac
}

norm_code() {
  local c
  c="$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9')"
  [[ "$c" =~ ^[A-Z0-9]{8}$ ]] || { echo "Verification code must be 8 letters/numbers (like V4JB-GHKH)." >&2; exit 1; }
  printf '%s' "$c"
}

show_ticket_sql() {
  echo "SELECT u.raffle_user_id, s.email, e.event_title, u.raffle_number,
               substr(u.raffle_generated_id, 1, 4) || '-' || substr(u.raffle_generated_id, 5) AS code,
               u.raffle_status, u.raffle_claimed_datetime, u.paypal_info, u.venmo_info,
               u.raffle_prize_paid, u.raffle_prize_paid_datetime
          FROM $S.raffle_user u
          JOIN $S.raffle_event e ON e.event_id = u.event_id
          LEFT JOIN $S.singles s ON s.singles_id = u.singles_id
         WHERE $1
         ORDER BY u.raffle_claimed_datetime NULLS LAST, u.raffle_user_id;"
}

cmd="${1:-}"
case "$cmd" in
  list)
    run_sql "${2:-local}" "$(show_ticket_sql "u.raffle_status IS NOT NULL")"
    ;;
  paid|unpaid)
    [[ $# -ge 2 ]] || usage
    code="$(norm_code "$2")"
    if [[ "$cmd" == paid ]]; then
      set_clause="raffle_status = 'PAID', raffle_prize_paid = true, raffle_prize_paid_datetime = now()"
      from_status="CLAIMED"
    else
      set_clause="raffle_status = 'CLAIMED', raffle_prize_paid = NULL, raffle_prize_paid_datetime = NULL"
      from_status="PAID"
    fi
    run_sql "${3:-local}" "UPDATE $S.raffle_user SET $set_clause WHERE raffle_generated_id = '$code' AND raffle_status = '$from_status';
                          $(show_ticket_sql "u.raffle_generated_id = '$code'")"
    ;;
  claimed)
    [[ $# -ge 3 ]] || usage
    code="$(norm_code "$2")"
    when="$3"
    [[ "$when" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}[\ T][0-9]{2}:[0-9]{2}(:[0-9]{2})?([+-][0-9]{2}(:?[0-9]{2})?)?$ ]] \
      || { echo "Datetime must look like 2026-10-16 11:03:54-04" >&2; exit 1; }
    run_sql "${4:-local}" "UPDATE $S.raffle_user SET raffle_claimed_datetime = '$when'::timestamptz
                            WHERE raffle_generated_id = '$code' AND raffle_status IS NOT NULL;
                          $(show_ticket_sql "u.raffle_generated_id = '$code'")"
    ;;
  *) usage ;;
esac
