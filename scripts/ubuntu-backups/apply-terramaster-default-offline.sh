#!/usr/bin/env bash
# Make TerraMaster restic volume default to USB powered-off (offline).
# - fstab noauto: never mount at boot
# - systemd oneshot after boot: umount + power-off if something mounted anyway
# Run on Ubuntu as root: sudo scripts/ubuntu-backups/apply-terramaster-default-offline.sh
set -euo pipefail

MOUNT_POINT=/mnt/terramaster
FSTAB=/etc/fstab
POWER=/home/lawsen0/backups/scripts/terramaster-enclosure-power.sh
UNIT=/etc/systemd/system/terramaster-default-offline.service

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
[[ -x "$POWER" ]] || { echo "Missing $POWER — run install-ubuntu-backup-scripts.sh first." >&2; exit 1; }

if grep -qE "^[^#].*[[:space:]]${MOUNT_POINT}[[:space:]]" "$FSTAB"; then
  if grep -E "^[^#].*[[:space:]]${MOUNT_POINT}[[:space:]]" "$FSTAB" | grep -q noauto; then
    echo "[terramaster] fstab already has noauto for $MOUNT_POINT"
  else
    cp -a "$FSTAB" "${FSTAB}.bak-$(date +%Y%m%d-%H%M%S)"
    awk -v mnt="$MOUNT_POINT" '
      $0 !~ /^#/ && $2 == mnt && $4 !~ /noauto/ {
        $4 = $4 ",noauto"
      }
      { print }
    ' "$FSTAB" > "${FSTAB}.tmp"
    mv "${FSTAB}.tmp" "$FSTAB"
    echo "[terramaster] added noauto to fstab entry for $MOUNT_POINT"
    grep -E "^[^#].*[[:space:]]${MOUNT_POINT}[[:space:]]" "$FSTAB"
  fi
else
  echo "WARNING: no fstab line for $MOUNT_POINT" >&2
fi

cat >"$UNIT" <<EOF
[Unit]
Description=Park TerraMaster restic USB enclosure after boot (default offline)
After=local-fs.target
ConditionPathExists=$POWER

[Service]
Type=oneshot
ExecStart=$POWER sleep
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable terramaster-default-offline.service
echo "[terramaster] enabled terramaster-default-offline.service (@reboot sleep)"

echo "[terramaster] powering off now (if mounted)..."
"$POWER" sleep || true

echo "[terramaster] default-offline apply done. Run: terramasterstatus (after source ~/b)"
