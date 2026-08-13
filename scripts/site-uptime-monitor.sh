#!/usr/bin/env bash
# 24x7 website uptime monitor — independent of PM2 (onlinemallwebsite).
# Curls a few public URLs; on failure, SMS +17035477456 and log the send.
#
# Install (Ubuntu): sudo scripts/install-site-uptime-monitor.sh
# Logs: ~/logs/site-uptime-monitor/monitor.log  and  sms-sent.log
set -u

ENV_FILE="${SITE_UPTIME_ENV_FILE:-${HOME}/.ssh/be/.env}"
LOG_DIR="${SITE_UPTIME_LOG_DIR:-${HOME}/logs/site-uptime-monitor}"
SMS_TO="${SITE_UPTIME_SMS_TO:-+17035477456}"
INTERVAL_SEC="${SITE_UPTIME_INTERVAL_SEC:-30}"
CURL_MAX_TIME="${SITE_UPTIME_CURL_MAX_TIME:-15}"
SMS_COOLDOWN_SEC="${SITE_UPTIME_SMS_COOLDOWN_SEC:-900}"
BASE_URL="${SITE_UPTIME_BASE_URL:-https://onlinemall.website}"

MONITOR_LOG="${LOG_DIR}/monitor.log"
SMS_LOG="${LOG_DIR}/sms-sent.log"
STATE_FILE="${LOG_DIR}/last-sms-epoch"

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
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  raw="${line#*=}"
  raw="${raw%$'\r'}"
  if [[ "$raw" == \"*\" && "$raw" == *\" ]]; then
    raw="${raw:1:${#raw}-2}"
  elif [[ "$raw" == \'*\' && "$raw" == *\' ]]; then
    raw="${raw:1:${#raw}-2}"
  fi
  printf '%s' "$raw"
}

TWILIO_ACCOUNT_SID="$(read_env_value TWILIO_ACCOUNT_SID "$ENV_FILE")"
TWILIO_AUTH_TOKEN="$(read_env_value TWILIO_AUTH_TOKEN "$ENV_FILE")"
TWILIO_FROM="$(read_env_value TWILIO_PHONE_NUMBER "$ENV_FILE")"
if [[ -z "$TWILIO_FROM" ]]; then
  TWILIO_FROM="$(read_env_value TWILIO_FROM "$ENV_FILE")"
fi

ts() {
  date '+%Y-%m-%d %H:%M:%S %Z'
}

log_monitor() {
  echo "$(ts) $*" | tee -a "$MONITOR_LOG"
}

log_sms() {
  echo "$(ts) $*" | tee -a "$SMS_LOG"
}

now_epoch() {
  date +%s
}

last_sms_epoch() {
  if [[ -f "$STATE_FILE" ]]; then
    cat "$STATE_FILE" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

mark_sms_sent() {
  now_epoch >"$STATE_FILE"
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

send_sms() {
  local body="$1"
  if [[ -z "$TWILIO_ACCOUNT_SID" || -z "$TWILIO_AUTH_TOKEN" || -z "$TWILIO_FROM" ]]; then
    log_sms "SMS NOT SENT (Twilio env missing in ${ENV_FILE}) to=${SMS_TO} body=${body}"
    return 1
  fi
  local resp http
  resp="$(mktemp)"
  http="$(
    curl -sS -o "$resp" -w '%{http_code}' \
      --max-time 20 \
      -X POST "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json" \
      -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
      --data-urlencode "To=${SMS_TO}" \
      --data-urlencode "From=${TWILIO_FROM}" \
      --data-urlencode "Body=${body}" \
      || true
  )"
  local sid
  sid="$(grep -oE '"sid"[[:space:]]*:[[:space:]]*"[^"]+"' "$resp" | head -1 | sed 's/.*"sid"[[:space:]]*:[[:space:]]*"//;s/"$//')"
  local err_msg
  err_msg="$(grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]+"' "$resp" | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/"$//')"
  rm -f "$resp"
  if [[ "$http" =~ ^2[0-9][0-9]$ ]]; then
    log_sms "SMS SENT to=${SMS_TO} twilio_http=${http} sid=${sid:-?} body=${body}"
    mark_sms_sent
    return 0
  fi
  log_sms "SMS FAILED to=${SMS_TO} twilio_http=${http:-000} error=${err_msg:-unknown} body=${body}"
  return 1
}

maybe_send_failure_sms() {
  local fail_at="$1"
  local detail="$2"
  local last now elapsed
  last="$(last_sms_epoch)"
  now="$(now_epoch)"
  elapsed=$((now - last))
  if [[ "$last" != "0" && "$elapsed" -lt "$SMS_COOLDOWN_SEC" ]]; then
    log_monitor "FAIL ${detail} sms=skipped cooldown_remaining=$((SMS_COOLDOWN_SEC - elapsed))s"
    return 0
  fi
  local msg
  msg="OnlineMall DOWN at ${fail_at}: ${detail}"
  if send_sms "$msg"; then
    log_monitor "FAIL ${detail} sms=sent"
  else
    log_monitor "FAIL ${detail} sms=failed"
  fi
}

log_monitor "START interval=${INTERVAL_SEC}s urls=${URLS[*]} sms_to=${SMS_TO} cooldown=${SMS_COOLDOWN_SEC}s"

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
    fail_at="$(ts)"
    maybe_send_failure_sms "$fail_at" "$FAIL_DETAIL"
    DOWN=1
  else
    if [[ "$DOWN" -eq 1 ]]; then
      log_monitor "RECOVERED all curls succeeded"
      DOWN=0
    fi
  fi
  sleep "$INTERVAL_SEC"
done
