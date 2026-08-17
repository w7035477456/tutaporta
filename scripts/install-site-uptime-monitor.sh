#!/usr/bin/env bash
# Install 24x7 website curl+SMS+USB-speaker monitor as a systemd service (not PM2).
#
#   sudo bash scripts/install-site-uptime-monitor.sh
#
# Then: sudo systemctl status site-uptime-monitor
# Logs:  ~/logs/site-uptime-monitor/sms-sent.log
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_SRC="${SCRIPT_DIR}/site-uptime-monitor.sh"
UNIT_SRC="${SCRIPT_DIR}/site-uptime-monitor.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/install-site-uptime-monitor.sh" >&2
  exit 1
fi

RUN_USER="${SUDO_USER:-lawsen0}"
if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "User ${RUN_USER} not found." >&2
  exit 1
fi
RUN_GROUP="$(id -gn "$RUN_USER")"
RUN_UID="$(id -u "$RUN_USER")"
HOME_DIR="$(getent passwd "$RUN_USER" | cut -d: -f6)"
INSTALL_DIR="${HOME_DIR}/bin"
SCRIPT_PATH="${INSTALL_DIR}/site-uptime-monitor.sh"
LOG_DIR="${HOME_DIR}/logs/site-uptime-monitor"
UNIT_PATH="/etc/systemd/system/site-uptime-monitor.service"

if getent group audio >/dev/null 2>&1; then
  usermod -aG audio "$RUN_USER" || true
fi
if ! command -v speaker-test >/dev/null 2>&1 || ! command -v aplay >/dev/null 2>&1; then
  echo "Installing alsa-utils (speaker-test / aplay) for USB speaker alarm..."
  apt-get install -y alsa-utils
fi

[[ -f "$MONITOR_SRC" ]] || { echo "Missing $MONITOR_SRC" >&2; exit 1; }
[[ -f "$UNIT_SRC" ]] || { echo "Missing $UNIT_SRC" >&2; exit 1; }

install -d -o "$RUN_USER" -g "$RUN_GROUP" -m 0755 "$INSTALL_DIR"
install -d -o "$RUN_USER" -g "$RUN_GROUP" -m 0755 "$LOG_DIR"
install -o "$RUN_USER" -g "$RUN_GROUP" -m 0755 "$MONITOR_SRC" "$SCRIPT_PATH"
touch "${LOG_DIR}/monitor.log" "${LOG_DIR}/sms-sent.log"
chown -R "$RUN_USER:$RUN_GROUP" "$LOG_DIR"
chmod 0644 "${LOG_DIR}/monitor.log" "${LOG_DIR}/sms-sent.log"

sed \
  -e "s|__RUN_USER__|${RUN_USER}|g" \
  -e "s|__RUN_GROUP__|${RUN_GROUP}|g" \
  -e "s|__RUN_UID__|${RUN_UID}|g" \
  -e "s|__HOME_DIR__|${HOME_DIR}|g" \
  -e "s|__SCRIPT_PATH__|${SCRIPT_PATH}|g" \
  "$UNIT_SRC" >"$UNIT_PATH"
chmod 0644 "$UNIT_PATH"

systemctl daemon-reload
systemctl enable site-uptime-monitor.service
systemctl restart site-uptime-monitor.service

if ! grep -q 'START v6' "$SCRIPT_PATH"; then
  echo "WARNING: installed script at ${SCRIPT_PATH} is not the latest (missing v6 SERVERDOWN_TEXT). Copy ~/code/main first." >&2
fi

echo
echo "Installed site-uptime-monitor (systemd, independent of PM2)."
echo "  service: site-uptime-monitor"
echo "  script:  ${SCRIPT_PATH}"
echo "  sms log: ${LOG_DIR}/sms-sent.log"
echo "  run log: ${LOG_DIR}/monitor.log"
echo
systemctl --no-pager --full status site-uptime-monitor.service || true
echo
echo "Useful commands:"
echo "  sudo systemctl status site-uptime-monitor"
echo "  sudo journalctl -u site-uptime-monitor -f"
echo "  tail -f ${LOG_DIR}/sms-sent.log"
echo
echo "Send a test text (site can stay up):"
echo "  rm -f ${LOG_DIR}/sms-state"
echo "  sudo -u ${RUN_USER} ${SCRIPT_PATH} --test-sms"
echo "  tail -5 ${LOG_DIR}/sms-sent.log"
echo
echo "USB speaker alarm (plays until you Ctrl-C, or 8s for --test-alarm):"
echo "  sudo -u ${RUN_USER} ${SCRIPT_PATH} --list-audio"
echo "  sudo -u ${RUN_USER} ${SCRIPT_PATH} --test-alarm"
