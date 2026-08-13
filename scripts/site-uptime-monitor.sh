#!/usr/bin/env bash
# 24x7 website uptime monitor — independent of PM2 (onlinemallwebsite).
# Curls a few public URLs; on failure, SMS +17035477456 and log the send.
#
# Install (Ubuntu): sudo scripts/install-site-uptime-monitor.sh
# Logs: ~/logs/site-uptime-monitor/monitor.log  and  sms-sent.log
set -u

ENV_FILE="${SITE_UPTIME_ENV_FILE:-${HOME}/.ssh/be/.env}"
LOG_DIR="${SITE_UPTIME_LOG_DIR:-${HOME}/logs/site-uptime-monitor}"
INTERVAL_SEC="${SITE_UPTIME_INTERVAL_SEC:-30}"
CURL_MAX_TIME="${SITE_UPTIME_CURL_MAX_TIME:-15}"
# SMS while still down: 3 texts every 10 min, then 3 hourly, then once a day.
FAST_SMS_SEC="${SITE_UPTIME_FAST_SMS_SEC:-600}"
FAST_SMS_COUNT="${SITE_UPTIME_FAST_SMS_COUNT:-3}"
HOURLY_SMS_SEC="${SITE_UPTIME_HOURLY_SMS_SEC:-3600}"
HOURLY_SMS_COUNT="${SITE_UPTIME_HOURLY_SMS_COUNT:-3}"
DAILY_SMS_SEC="${SITE_UPTIME_DAILY_SMS_SEC:-86400}"
BASE_URL="${SITE_UPTIME_BASE_URL:-https://onlinemall.website}"

MONITOR_LOG="${LOG_DIR}/monitor.log"
SMS_LOG="${LOG_DIR}/sms-sent.log"
STATE_FILE="${LOG_DIR}/sms-state"

URLS=(
  "${BASE_URL}/"
  "${BASE_URL}/health"
  "${BASE_URL}/api/health"
)

mkdir -p "${LOG_DIR}"

read_env_value() {
  local key="$1"
  local file="$2"
  local line raw
  [[ -f "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  raw="${line#*=}"
  raw="${raw%$'\r'}"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  if [[ "$raw" == \"*\" && "$raw" == *\" ]]; then
    raw="${raw:1:${#raw}-2}"
  elif [[ "$raw" == \'*\' && "$raw" == *\' ]]; then
    raw="${raw:1:${#raw}-2}"
  fi
  printf '%s' "$raw"
}

TWILIO_ACCOUNT_SID="$(read_env_value TWILIO_ACCOUNT_SID "$ENV_FILE")"
TWILIO_AUTH_TOKEN="$(read_env_value TWILIO_AUTH_TOKEN "$ENV_FILE")"
TWILIO_SERVICE_SID="$(read_env_value TWILIO_SERVICE_SID "$ENV_FILE")"
if [[ -z "$TWILIO_SERVICE_SID" ]]; then
  TWILIO_SERVICE_SID="$(read_env_value TWILIO_ServiceSID "$ENV_FILE")"
fi
SMS_TO="${SITE_UPTIME_SMS_TO:-$(read_env_value SITE_UPTIME_SMS_TO "$ENV_FILE")}"
if [[ -z "$SMS_TO" ]]; then
  SMS_TO="+17035477456"
fi

ts() {
  date '+%Y-%m-%d %H:%M:%S %Z'
}

log_monitor() {
  echo "$(ts) $*" | tee -a "$MONITOR_LOG" >/dev/null
  echo "$(ts) $*"
}

log_sms() {
  if ! echo "$(ts) $*" >>"$SMS_LOG" 2>/dev/null; then
    echo "$(ts) SMS_LOG_WRITE_FAILED file=${SMS_LOG} $*" >&2
  fi
  echo "$(ts) $*"
}

now_epoch() {
  date +%s
}

# sms-state: "sent_count last_epoch"
read_sms_state() {
  SMS_SENT_COUNT=0
  SMS_LAST_EPOCH=0
  if [[ -f "$STATE_FILE" ]]; then
    local line
    line="$(tr -d '\r' <"$STATE_FILE" | head -n 1)"
    SMS_SENT_COUNT="${line%% *}"
    SMS_LAST_EPOCH="${line#* }"
    [[ "$SMS_SENT_COUNT" =~ ^[0-9]+$ ]] || SMS_SENT_COUNT=0
    [[ "$SMS_LAST_EPOCH" =~ ^[0-9]+$ ]] || SMS_LAST_EPOCH=0
  fi
}

write_sms_state() {
  echo "$1 $2" >"$STATE_FILE"
}

clear_sms_state() {
  rm -f "$STATE_FILE" "${LOG_DIR}/last-sms-epoch"
}

clear_logs_after_recovery() {
  : >"$MONITOR_LOG"
  : >"$SMS_LOG"
}

reset_after_recovery() {
  clear_sms_state
  clear_logs_after_recovery
  DOWN=0
  log_monitor "RECOVERED site is up — logs cleared, SMS schedule reset (3x10min then 3x1h then daily)"
}

# Seconds to wait after SMS number `sent_count` before sending the next one.
# 0 sent → send immediately; next 2 at 10 min; next 3 hourly; then daily.
next_sms_wait_sec() {
  local sent="$1"
  if [[ "$sent" -lt "$FAST_SMS_COUNT" ]]; then
    if [[ "$sent" -eq 0 ]]; then
      echo 0
    else
      echo "$FAST_SMS_SEC"
    fi
    return
  fi
  if [[ "$sent" -lt $((FAST_SMS_COUNT + HOURLY_SMS_COUNT)) ]]; then
    echo "$HOURLY_SMS_SEC"
    return
  fi
  echo "$DAILY_SMS_SEC"
}

sms_phase_label() {
  local next_n=$(( ${1} + 1 ))
  if [[ "$next_n" -le "$FAST_SMS_COUNT" ]]; then
    echo "10min ${next_n}/${FAST_SMS_COUNT}"
  elif [[ "$next_n" -le $((FAST_SMS_COUNT + HOURLY_SMS_COUNT)) ]]; then
    echo "hourly $((next_n - FAST_SMS_COUNT))/${HOURLY_SMS_COUNT}"
  else
    echo "daily $((next_n - FAST_SMS_COUNT - HOURLY_SMS_COUNT))"
  fi
}

check_url() {
  local url="$1"
  local body_file http_code curl_exit
  body_file="$(mktemp)"
  http_code="$(
    curl -sS -L --compressed \
      --max-time "$CURL_MAX_TIME" \
      --connect-timeout 8 \
      -A 'Mozilla/5.0 (compatible; OnlineMallUptimeMonitor/1.0)' \
      -o "$body_file" \
      -w '%{http_code}' \
      "$url" 2>"${body_file}.err" || true
  )"
  curl_exit=0
  if [[ ! "$http_code" =~ ^[0-9]{3}$ ]]; then
    http_code="000"
    curl_exit=1
  fi
  local err
  err="$(tr '\n' ' ' <"${body_file}.err" 2>/dev/null | sed 's/[[:space:]]\+/ /g')"
  rm -f "$body_file" "${body_file}.err"
  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    return 0
  fi
  FAIL_DETAIL="url=${url} http=${http_code}${err:+ err=${err}}"
  return 1
}

json_field() {
  local key="$1"
  local file="$2"
  grep -oE "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$file" 2>/dev/null | head -1 | sed "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

send_sms() {
  local body="$1"
  if [[ -z "$TWILIO_ACCOUNT_SID" || -z "$TWILIO_AUTH_TOKEN" || -z "$TWILIO_SERVICE_SID" ]]; then
    log_sms "SMS NOT SENT (Twilio Verify env missing in ${ENV_FILE}) sid_len=${#TWILIO_ACCOUNT_SID} token_len=${#TWILIO_AUTH_TOKEN} verify_sid_len=${#TWILIO_SERVICE_SID} to=${SMS_TO} body=${body}"
    return 1
  fi
  local resp http
  resp="$(mktemp)"
  # Same Twilio Verify path as signup SMS (To + Channel only).
  # Do NOT send CustomFriendlyName — Twilio error 60204 unless Sales enables it.
  http="$(
    curl -sS -o "$resp" -w '%{http_code}' \
      --max-time 20 \
      -X POST "https://verify.twilio.com/v2/Services/${TWILIO_SERVICE_SID}/Verifications" \
      --user "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
      --data-urlencode "To=${SMS_TO}" \
      --data-urlencode "Channel=sms" \
      || true
  )"
  local sid status err_msg err_code snippet
  sid="$(json_field sid "$resp")"
  status="$(json_field status "$resp")"
  err_msg="$(json_field message "$resp")"
  err_code="$(json_field code "$resp")"
  snippet="$(tr '\n' ' ' <"$resp" | sed 's/[[:space:]]\+/ /g' | cut -c1-400)"
  rm -f "$resp"
  if [[ "$http" =~ ^2[0-9][0-9]$ && "$sid" =~ ^VE ]]; then
    log_sms "SMS SENT (Twilio Verify / signup-style) to=${SMS_TO} twilio_http=${http} status=${status:-?} sid=${sid} note=${body}"
    return 0
  fi
  log_sms "SMS FAILED (Twilio Verify) to=${SMS_TO} twilio_http=${http:-000} status=${status:-?} code=${err_code:-?} error=${err_msg:-unknown} note=${body} raw=${snippet}"
  return 1
}

maybe_send_failure_sms() {
  local fail_at="$1"
  local detail="$2"
  local now wait elapsed phase
  read_sms_state
  now="$(now_epoch)"
  wait="$(next_sms_wait_sec "$SMS_SENT_COUNT")"
  elapsed=$((now - SMS_LAST_EPOCH))
  if [[ "$SMS_SENT_COUNT" -gt 0 && "$elapsed" -lt "$wait" ]]; then
    log_monitor "FAIL ${detail} sms=skipped next_in=$((wait - elapsed))s phase=$(sms_phase_label "$SMS_SENT_COUNT")"
    return 0
  fi
  phase="$(sms_phase_label "$SMS_SENT_COUNT")"
  local msg
  msg="OnlineMall DOWN at ${fail_at} [${phase}]: ${detail}"
  if send_sms "$msg"; then
    write_sms_state $((SMS_SENT_COUNT + 1)) "$(now_epoch)"
    log_monitor "FAIL ${detail} sms=sent phase=${phase} count=$((SMS_SENT_COUNT + 1))"
  else
    log_monitor "FAIL ${detail} sms=failed phase=${phase}"
  fi
}

if [[ "${1:-}" == "--test-sms" || "${1:-}" == "test-sms" ]]; then
  clear_sms_state
  log_monitor "TEST-SMS (Twilio Verify) env=${ENV_FILE} to=${SMS_TO} sid_len=${#TWILIO_ACCOUNT_SID} token_len=${#TWILIO_AUTH_TOKEN} verify_sid_len=${#TWILIO_SERVICE_SID}"
  send_sms "OnlineMall uptime monitor test at $(ts)"
  exit $?
fi

log_monitor "START v4 interval=${INTERVAL_SEC}s urls=${URLS[*]} sms_to=${SMS_TO} verify_sid_len=${#TWILIO_SERVICE_SID} sid_len=${#TWILIO_ACCOUNT_SID} token_len=${#TWILIO_AUTH_TOKEN} schedule=3x10min then 3x1h then daily immediate_on_new_outage=1 no_custom_friendly_name=1"

DOWN=0
while true; do
  FAIL_DETAIL=""
  ALL_OK=1
  for url in "${URLS[@]}"; do
    if ! check_url "$url"; then
      ALL_OK=0
      break
    fi
  done

  if [[ "$ALL_OK" -eq 0 ]]; then
    if [[ "$DOWN" -eq 0 ]]; then
      clear_sms_state
      log_monitor "NEW OUTAGE — SMS schedule reset, first text now"
    fi
    fail_at="$(ts)"
    maybe_send_failure_sms "$fail_at" "$FAIL_DETAIL"
    DOWN=1
  else
    if [[ "$DOWN" -eq 1 ]]; then
      reset_after_recovery
    else
      clear_sms_state
    fi
  fi
  sleep "$INTERVAL_SEC"
done
