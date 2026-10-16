#!/usr/bin/env bash
# Interactive insert of a raffle host or raffle event (outdateddbsnapshotoct2024).
#
#   scripts/raffle-setup.sh host            # new raffle_host row   (local Postgres)
#   scripts/raffle-setup.sh event           # new raffle_event row  (local Postgres)
#   scripts/raffle-setup.sh host ubuntu     # from the Mac, insert on Ubuntu Primary via ubuntu-psql.sh
#   scripts/raffle-setup.sh event ubuntu
#
# Blank answer = NULL (except required fields). setup_event first asks the event's time zone
# (Eastern default; Central / Mountain / Western-Pacific, or any IANA name), then date/times are
# typed as "YYYY-MM-DD HH:MM" in that zone. Nothing is written until you confirm the summary.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S=outdateddbsnapshotoct2024
TZ_NAME=America/New_York
TZ_LABEL=Eastern

kind="${1:-}"
target="${2:-local}"
case "$kind" in host|event) ;; *) echo "usage: $0 host|event [local|ubuntu]" >&2; exit 2 ;; esac
case "$target" in local|ubuntu) ;; *) echo "target must be local or ubuntu" >&2; exit 2 ;; esac

run_sql() {
  if [[ "$target" == ubuntu ]]; then
    "$SCRIPT_DIR/ubuntu-psql.sh" "$@"
  else
    psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 "$@"
  fi
}

lit() {
  if [[ -z "$1" ]]; then printf 'NULL'; else printf "'%s'" "${1//\'/\'\'}"; fi
}

ts_lit() {
  if [[ -z "$1" ]]; then printf 'NULL'; else printf "(TIMESTAMP %s AT TIME ZONE '%s')" "$(lit "$1")" "$TZ_NAME"; fi
}

ask() {
  local prompt="$1" required="${2:-}" answer
  while true; do
    read -r -p "$prompt: " answer
    answer="${answer#"${answer%%[![:space:]]*}"}"
    answer="${answer%"${answer##*[![:space:]]}"}"
    if [[ -n "$answer" || -z "$required" ]]; then printf '%s' "$answer"; return; fi
    echo "  (required)" >&2
  done
}

ask_ts() {
  local prompt="$1" required="${2:-}" answer
  while true; do
    answer="$(ask "$prompt (YYYY-MM-DD HH:MM, $TZ_LABEL)" "$required")"
    if [[ -z "$answer" || "$answer" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}([[:space:]][0-9]{1,2}:[0-9]{2})?$ ]]; then
      printf '%s' "$answer"; return
    fi
    echo "  use format 2026-10-29 18:00 (time zone is chosen above, not typed here)" >&2
  done
}

ask_tz() {
  local answer valid
  while true; do
    answer="$(ask "Event time zone: E=Eastern, C=Central, M=Mountain, W=Western/Pacific, or IANA name [E]")"
    case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
      ''|e|et|east|eastern)            TZ_NAME=America/New_York;    TZ_LABEL=Eastern ;;
      c|ct|central)                    TZ_NAME=America/Chicago;     TZ_LABEL=Central ;;
      m|mt|mountain)                   TZ_NAME=America/Denver;      TZ_LABEL=Mountain ;;
      w|p|pt|west|western|pacific)     TZ_NAME=America/Los_Angeles; TZ_LABEL=Western ;;
      *)
        valid="$(run_sql -At -c "SELECT 1 FROM pg_timezone_names WHERE name = $(lit "$answer");")"
        if [[ "$valid" != 1 ]]; then echo "  unknown time zone: $answer" >&2; continue; fi
        TZ_NAME="$answer"; TZ_LABEL="$answer" ;;
    esac
    echo "  using $TZ_LABEL ($TZ_NAME)"
    return
  done
}

confirm() {
  local answer
  read -r -p "Insert this row on [$target]? (y/N): " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled, nothing written."; exit 1; }
}

setup_host() {
  echo "New raffle_host on [$target]"
  local name email phone url
  name="$(ask "host_full_name" required)"
  email="$(ask "host_email")"
  phone="$(ask "host_phone")"
  url="$(ask "host_url")"

  printf '\n  host_full_name = %s\n  host_email     = %s\n  host_phone     = %s\n  host_url       = %s\n\n' \
    "$name" "${email:-NULL}" "${phone:-NULL}" "${url:-NULL}"
  confirm

  run_sql -c "INSERT INTO $S.raffle_host (host_full_name, host_email, host_phone, host_url)
VALUES ($(lit "$name"), $(lit "$email"), $(lit "$phone"), $(lit "$url"))
RETURNING raffle_host_id, host_full_name, host_email, host_phone, host_url;"
}

setup_event() {
  echo "New raffle_event on [$target]"
  echo "Existing hosts:"
  run_sql -c "SELECT raffle_host_id, host_full_name, host_url FROM $S.raffle_host ORDER BY raffle_host_id;"

  local host_id host_name
  while true; do
    host_id="$(ask "raffle_host_id" required)"
    if [[ "$host_id" =~ ^[0-9]+$ ]]; then
      host_name="$(run_sql -At -c "SELECT host_full_name FROM $S.raffle_host WHERE raffle_host_id = $host_id;")"
      [[ -n "$host_name" ]] && break
      echo "  no raffle_host with id $host_id (run setup_host first)" >&2
    else
      echo "  must be a number" >&2
    fi
  done

  local title url night addr start end show
  title="$(ask "event_title" required)"
  url="$(ask "event_url (Meetup event link opened from the dropdown)")"
  ask_tz
  night="$(ask_ts "event_night_datetime")"
  addr="$(ask "event_build_n_address")"
  start="$(ask_ts "host_event_raffle_start" required)"
  end="$(ask_ts "host_event_raffle_end" required)"
  show="$(ask "event_show_combo - show in Get My Raffle dropdown? (Y/n)")"
  if [[ "$show" =~ ^[Nn] ]]; then show=false; else show=true; fi

  printf '\n  raffle_host_id          = %s (%s)\n  event_title             = %s\n  event_url               = %s\n  event_night_datetime    = %s\n  event_build_n_address   = %s\n  host_event_raffle_start = %s\n  host_event_raffle_end   = %s\n  event_show_combo        = %s\n  (times are %s, %s)\n\n' \
    "$host_id" "$host_name" "$title" "${url:-NULL}" "${night:-NULL}" "${addr:-NULL}" "$start" "$end" "$show" "$TZ_LABEL" "$TZ_NAME"
  confirm

  run_sql -c "INSERT INTO $S.raffle_event
  (event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime,
   event_build_n_address, host_event_raffle_start, host_event_raffle_end, event_time_zone)
VALUES ($show, $host_id, $(lit "$title"), $(lit "$url"), $(ts_lit "$night"),
  $(lit "$addr"), $(ts_lit "$start"), $(ts_lit "$end"), $(lit "$TZ_NAME"))
RETURNING event_id, event_title, event_show_combo, raffle_host_id, event_time_zone,
  event_night_datetime AT TIME ZONE '$TZ_NAME' AS night_local,
  host_event_raffle_start AT TIME ZONE '$TZ_NAME' AS raffle_start_local,
  host_event_raffle_end AT TIME ZONE '$TZ_NAME' AS raffle_end_local;"
}

"setup_$kind"
