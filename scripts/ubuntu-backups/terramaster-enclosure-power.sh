#!/usr/bin/env bash
# Wake / spin down / power-off the external TerraMaster restic volume.
# Used by backup-nightly.sh (cron) and manual aliases in ~/b (waketerramaster).
#
# Must run as root (sudo). Reads UUID + mount point from /etc/fstab.
set -euo pipefail

TERRAMASTER_MOUNT="${TERRAMASTER_MOUNT:-/mnt/terramaster}"
TERRAMASTER_WAKE_WAIT_SEC="${TERRAMASTER_WAKE_WAIT_SEC:-180}"

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

# After udisksctl power-off the block node may vanish; cycle USB auth on TerraMaster.
_terramaster_usb_cycle() {
  local product_path devdir
  for product_path in /sys/bus/usb/devices/*/product; do
    [[ -f "$product_path" ]] || continue
    if grep -qiE 'terra|tdas' "$product_path" 2>/dev/null; then
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
        return 0
      fi
    fi
    _terramaster_usb_cycle || true
    udevadm settle 2>/dev/null || true
    sleep 2
    elapsed=$((elapsed + 2))
  done

  _terramaster_die "could not mount $TERRAMASTER_MOUNT after ${TERRAMASTER_WAKE_WAIT_SEC}s (is the enclosure plugged in and powered at the wall?)"
}

# ---- public: umount + standby + USB power-off -------------------------------
terramaster_spin_down_and_power_off() {
  local uuid dev

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

  _terramaster_log "USB power-off (udisks)"
  if udisksctl power-off -b "$dev" 2>/dev/null \
    || udisksctl power-off -b "/dev/disk/by-uuid/$uuid" 2>/dev/null; then
    _terramaster_log "enclosure powered off — next backup will wake via terramaster_wake_and_mount"
    return 0
  fi

  echo "[terramaster] WARNING: udisksctl power-off failed; disk may still be online (standby was attempted)" >&2
  return 1
}

case "${1:-}" in
  wake) terramaster_wake_and_mount ;;
  sleep|off|power-off) terramaster_spin_down_and_power_off ;;
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
