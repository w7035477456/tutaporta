#!/usr/bin/env bash
# Wake / spin down / power-off the external TerraMaster restic volume.
# Used by backup-nightly.sh (cron) and manual aliases in ~/b (waketerramaster).
#
# Must run as root (sudo). Reads UUID + mount point from /etc/fstab.
set -euo pipefail

TERRAMASTER_MOUNT="${TERRAMASTER_MOUNT:-/mnt/terramaster}"
TERRAMASTER_WAKE_WAIT_SEC="${TERRAMASTER_WAKE_WAIT_SEC:-180}"
# Default soft sleep: umount + HDD standby, block device stays on USB (waketerramaster works).
# Set TERRAMASTER_HARD_POWER_OFF=1 (or "sleep hard") for udisks USB power-off — on many
# TerraMaster bridges the disk will NOT reappear until you press enclosure power or replug USB.
TERRAMASTER_HARD_POWER_OFF="${TERRAMASTER_HARD_POWER_OFF:-0}"
TERRAMASTER_USB_ID_FILE="${TERRAMASTER_USB_ID_FILE:-/home/lawsen0/backups/terramaster-usb-bridge.id}"

_terramaster_log() { echo "[terramaster] $*"; }
_terramaster_die() { echo "[terramaster] ERROR: $*" >&2; exit 1; }

_terramaster_fstab_uuid() {
  awk -v mnt="$TERRAMASTER_MOUNT" '
    $0 !~ /^#/ && $2 == mnt {
      gsub(/^UUID=/, "", $1)
      print $1
      exit
    }
  ' /etc/fstab
}

_terramaster_is_mounted() {
  findmnt -no SOURCE -T "$TERRAMASTER_MOUNT" >/dev/null 2>&1 \
    && [[ "$(findmnt -no SOURCE -T "$TERRAMASTER_MOUNT")" != "$(findmnt -no SOURCE -T /)" ]]
}

_terramaster_block_for_uuid() {
  local uuid="$1" dev
  [[ -n "$uuid" ]] || return 1
  if [[ -e "/dev/disk/by-uuid/$uuid" ]]; then
    readlink -f "/dev/disk/by-uuid/$uuid"
    return 0
  fi
  dev="$(blkid -U "$uuid" -o device 2>/dev/null || true)"
  [[ -n "$dev" && -b "$dev" ]] && readlink -f "$dev" && return 0
  return 1
}

_terramaster_scsi_rescan() {
  local host scan
  for host in /sys/class/scsi_host/host*; do
    [[ -d "$host" ]] || continue
    scan="$host/scan"
    [[ -w "$scan" ]] || continue
    echo '- - -' >"$scan" 2>/dev/null || true
  done
  udevadm settle 2>/dev/null || true
}

_terramaster_save_usb_bridge_id() {
  local dev="$1" props vid pid
  [[ -n "$dev" && -b "$dev" ]] || return 0
  props="$(udevadm info -q property -n "$dev" 2>/dev/null || true)"
  vid="$(printf '%s\n' "$props" | sed -n 's/^ID_USB_VENDOR_ID=//p' | head -1)"
  pid="$(printf '%s\n' "$props" | sed -n 's/^ID_USB_MODEL_ID=//p' | head -1)"
  [[ -n "$vid" && -n "$pid" ]] || return 0
  mkdir -p "$(dirname "$TERRAMASTER_USB_ID_FILE")"
  printf '%s:%s\n' "$vid" "$pid" >"$TERRAMASTER_USB_ID_FILE"
}

# Re-enumerate USB after hard power-off (best-effort; many enclosures still need a button press).
_terramaster_usb_cycle() {
  local product_path devdir vid pid id_path
  if [[ -r "$TERRAMASTER_USB_ID_FILE" ]]; then
    IFS=: read -r vid pid <"$TERRAMASTER_USB_ID_FILE" || true
    if [[ -n "${vid:-}" && -n "${pid:-}" ]]; then
      for id_path in /sys/bus/usb/devices/*; do
        [[ -f "$id_path/idVendor" && -f "$id_path/idProduct" ]] || continue
        [[ "$(cat "$id_path/idVendor" 2>/dev/null)" == "$vid" ]] \
          && [[ "$(cat "$id_path/idProduct" 2>/dev/null)" == "$pid" ]] || continue
        if [[ -w "$id_path/authorized" ]]; then
          _terramaster_log "USB re-enumerate saved bridge ${vid}:${pid} ($(basename "$id_path"))"
          echo 0 >"$id_path/authorized"
          sleep 2
          echo 1 >"$id_path/authorized"
          udevadm settle 2>/dev/null || true
          return 0
        fi
      done
    fi
  fi
  for product_path in /sys/bus/usb/devices/*/product; do
    [[ -f "$product_path" ]] || continue
    if grep -qiE 'terra|tdas|terramaster|usb3\.0 storage|storage device' "$product_path" 2>/dev/null; then
      devdir="$(dirname "$product_path")"
      if [[ -w "$devdir/authorized" ]]; then
        _terramaster_log "USB re-enumerate $(basename "$devdir") ($(tr -d '\n' < "$product_path" 2>/dev/null))"
        echo 0 >"$devdir/authorized"
        sleep 2
        echo 1 >"$devdir/authorized"
        udevadm settle 2>/dev/null || true
        return 0
      fi
    fi
  done
  return 1
}

_terramaster_scsi_start() {
  local dev="$1"
  if command -v sg_start >/dev/null 2>&1; then
    sg_start --start "$dev" 2>/dev/null || true
  fi
  if command -v hdparm >/dev/null 2>&1; then
    hdparm -B 254 -S 0 "$dev" 2>/dev/null || true
    hdparm -C "$dev" 2>/dev/null || true
  fi
}

# ---- public: wake + mount ---------------------------------------------------
terramaster_wake_and_mount() {
  local uuid dev elapsed=0

  if _terramaster_is_mounted; then
    _terramaster_log "already mounted at $TERRAMASTER_MOUNT"
    return 0
  fi

  uuid="$(_terramaster_fstab_uuid)" || _terramaster_die "no fstab UUID for $TERRAMASTER_MOUNT"
  _terramaster_log "waking enclosure (UUID $uuid)..."

  while (( elapsed < TERRAMASTER_WAKE_WAIT_SEC )); do
    if dev="$(_terramaster_block_for_uuid "$uuid")"; then
      _terramaster_scsi_start "$dev"
      if mount "$TERRAMASTER_MOUNT" 2>/dev/null; then
        _terramaster_log "mounted $TERRAMASTER_MOUNT from $dev"
        _terramaster_save_usb_bridge_id "$dev"
        return 0
      fi
      _terramaster_log "block device $dev present but mount failed — retrying"
    fi
    _terramaster_scsi_rescan
    _terramaster_usb_cycle || true
    udevadm settle 2>/dev/null || true
    sleep 2
    elapsed=$((elapsed + 2))
  done

  _terramaster_die "$(cat <<EOF
could not mount $TERRAMASTER_MOUNT after ${TERRAMASTER_WAKE_WAIT_SEC}s.
If the enclosure was USB power-off (udisks hard off), software wake often fails — press TerraMaster power or replug USB, wait for lsblk ~7.3T, then waketerramaster.
Otherwise check wall power, USB3 port (5000M), lsblk, lsusb.
EOF
)"
}

# ---- public: umount + standby + USB power-off -------------------------------
terramaster_spin_down_and_power_off() {
  local uuid dev hard="${TERRAMASTER_HARD_POWER_OFF:-0}"

  if [[ "${1:-}" == "hard" || "${1:-}" == "power-off" ]]; then
    hard=1
  fi

  uuid="$(_terramaster_fstab_uuid)" || _terramaster_die "no fstab UUID for $TERRAMASTER_MOUNT"

  if _terramaster_is_mounted; then
    _terramaster_log "sync + unmount $TERRAMASTER_MOUNT"
    sync
    umount "$TERRAMASTER_MOUNT" || _terramaster_die "umount $TERRAMASTER_MOUNT failed"
  else
    _terramaster_log "not mounted (continuing with spin-down / power-off)"
  fi

  dev="$(_terramaster_block_for_uuid "$uuid" || true)"
  if [[ -z "${dev:-}" || ! -b "$dev" ]]; then
    _terramaster_log "no block device — already powered off"
    return 0
  fi

  _terramaster_log "spinning down $dev"
  sync
  if command -v hdparm >/dev/null 2>&1; then
    hdparm -f "$dev" 2>/dev/null || true
    hdparm -y "$dev" 2>/dev/null || true
  fi
  if command -v sdparm >/dev/null 2>&1; then
    sdparm --flexible --command=stop "$dev" 2>/dev/null || true
  fi

  if [[ "$hard" != "1" ]]; then
    _terramaster_log "soft park complete (standby — software wake OK). Full USB off: TERRAMASTER_HARD_POWER_OFF=1 spinterramaster"
    return 0
  fi

  _terramaster_log "hard USB power-off (udisks) — may require enclosure button or replug to wake"
  if udisksctl power-off -b "$dev" 2>/dev/null \
    || udisksctl power-off -b "/dev/disk/by-uuid/$uuid" 2>/dev/null; then
    _terramaster_log "enclosure USB powered off"
    return 0
  fi

  echo "[terramaster] WARNING: udisksctl power-off failed; disk left in standby" >&2
  return 1
}

case "${1:-}" in
  wake) terramaster_wake_and_mount ;;
  sleep|off) terramaster_spin_down_and_power_off ;;
  power-off|hard-off) TERRAMASTER_HARD_POWER_OFF=1 terramaster_spin_down_and_power_off hard ;;
  status)
    uuid="$(_terramaster_fstab_uuid || true)"
    dev="$(_terramaster_block_for_uuid "${uuid:-}" 2>/dev/null || true)"
    drive_state=""
    enclosure_status="offline"

    if _terramaster_is_mounted; then
      enclosure_status="active"
      findmnt -T "$TERRAMASTER_MOUNT"
    else
      echo "$TERRAMASTER_MOUNT is not mounted"
    fi

    if [[ -n "${dev:-}" && -b "$dev" ]]; then
      if command -v hdparm >/dev/null 2>&1; then
        drive_state="$(hdparm -C "$dev" 2>/dev/null | sed -n 's/.*drive state is:[[:space:]]*\([^[:space:]]*\).*/\1/p' | tr '[:upper:]' '[:lower:]' || true)"
      fi
      if [[ "$enclosure_status" != "active" ]]; then
        case "$drive_state" in
          standby|sleeping) enclosure_status="spun_down" ;;
          *) enclosure_status="active" ;;
        esac
      fi
    fi

    echo "block device: ${dev:-none}"
    echo "drive state: ${drive_state:-n/a}"
    echo "enclosure status: $enclosure_status (active=spun up using power, spun_down=motor parked, offline=USB powered off)"
    ;;
  *)
    echo "Usage: $0 {wake|sleep|status}" >&2
    exit 2
    ;;
esac
