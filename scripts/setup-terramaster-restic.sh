#!/usr/bin/env bash
# Point the nightly restic repo at the real external TerraMaster enclosure
# (2 x 8 TB HDD in hardware RAID 1 -> shows up as ONE disk) instead of the
# temporary fake NAS folder ~/TERRAMASTER on the root LV.
#
# Idempotent: safe to re-run. Detects the enclosure, formats ext4 only if the
# disk is empty, mounts it at /mnt/terramaster via UUID in /etc/fstab
# (nofail, so a missing enclosure can never block boot), migrates the existing
# restic repo, repoints the env file, and hardens the "is it really mounted?"
# guard in backup-nightly.sh.
#
#   sudo scripts/setup-terramaster-restic.sh                 # auto-detect disk
#   sudo scripts/setup-terramaster-restic.sh --disk /dev/sdb # explicit
#   sudo scripts/setup-terramaster-restic.sh --dry-run       # print only
#
# Must run as root (mkfs / fstab / mount).
set -euo pipefail

MOUNT_POINT=/mnt/terramaster
OLD_FAKE=/home/lawsen0/TERRAMASTER
APP_USER=lawsen0
BACKUP_ENV=/home/lawsen0/backups/.backup-secrets-ubuntu.env
NIGHTLY=/home/lawsen0/backups/scripts/backup-nightly.sh
ENCLOSURE_POWER=/home/lawsen0/backups/scripts/terramaster-enclosure-power.sh
REPO_SUBDIR=restic-ubuntu
FS_LABEL=TERRAMASTER

DISK=""
DRY_RUN=0
YES=0
SKIP_MIGRATE=0
DO_FORMAT=0

usage() {
  cat <<'EOF'
setup-terramaster-restic.sh [options]
  --disk /dev/sdX   Enclosure block device (default: auto-detect the only
                    non-system disk, preferring TRAN=usb)
  --mount-point P   Default /mnt/terramaster
  --format          WIPE the enclosure and recreate ext4 tuned for a big HDD
                    backup volume (clean slate). Requires --yes or an
                    interactive typed confirmation.
  --no-migrate      Do not copy the existing repo, just mount + repoint
  --dry-run         Print every destructive command without running it
  --yes             Do not prompt before mkfs
  -h, --help        This help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --disk) DISK="${2:-}"; shift 2 ;;
    --mount-point) MOUNT_POINT="${2:-}"; shift 2 ;;
    --format) DO_FORMAT=1; shift ;;
    --no-migrate) SKIP_MIGRATE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "[terramaster] $*"; }

# Linux-only: relies on lsblk/findmnt/blkid/mkfs.ext4. Fail clearly instead of
# dying later with "lsblk: command not found" on a dev Mac.
if ! command -v lsblk >/dev/null 2>&1 || ! command -v findmnt >/dev/null 2>&1; then
  die "this script must run on the Ubuntu host (needs lsblk/findmnt). Copy it there and run it over SSH."
fi

# Everything after a dry run needs root (mkfs, fstab, mount, chown).
if [[ "$DRY_RUN" -eq 0 && "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "must run as root: sudo $0 $*"
fi

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  DRY-RUN $*"
    return 0
  fi
  echo "  + $*"
  "$@"
}
# ---------------------------------------------------------------- detection
# Resolve the physical disk(s) that carry the running system: /, /boot, /home
# may live on LVM/dm/LUKS, so walk up PKNAME until we reach a real disk.
disk_of() {
  local src dev parent depth=0
  src="$1"
  [[ -z "$src" ]] && return 0
  dev="$src"
  while :; do
    parent="$(lsblk -no PKNAME "$dev" 2>/dev/null | head -1 | tr -d ' ')"
    [[ -z "$parent" ]] && break
    dev="/dev/$parent"
    depth=$((depth + 1))
    [[ "$depth" -gt 8 ]] && break
  done
  basename "$dev"
}

# Space-delimited list of protected disk names. Avoids `declare -A`, which
# macOS's bash 3.2 does not have, so --dry-run also works on a dev Mac.
system_disks=""
add_system_disk() {
  local d="$1"
  [[ -z "$d" ]] && return 0
  case " $system_disks " in
    *" $d "*) ;;
    *) system_disks="$system_disks $d" ;;
  esac
}
is_system_disk() {
  case " $system_disks " in *" $1 "*) return 0 ;; esac
  return 1
}

for mp in / /boot /boot/efi /home /var /usr /opt; do
  src="$(findmnt -no SOURCE -T "$mp" 2>/dev/null || true)"
  [[ -z "$src" ]] && continue
  add_system_disk "$(disk_of "$src")"
done
# Anything already mounted under /mnt (Postgres data, old temp mounts) is off limits.
while read -r src _mp; do
  [[ -z "$src" ]] && continue
  add_system_disk "$(disk_of "$src")"
done < <(findmnt -rno SOURCE,TARGET 2>/dev/null | awk '$2 ~ /^\/mnt\//')

info "system disk(s) to protect: ${system_disks:- none}"
info "" 

detect_disk() {
  local name size tran model
  while read -r name size tran model; do
    [[ -z "$name" ]] && continue
    is_system_disk "$name" && continue
    printf '/dev/%s\t%s\t%s\t%s\n' "$name" "$size" "${tran:-unknown}" "${model:-unknown}"
  done < <(lsblk -dno NAME,SIZE,TRAN,MODEL | awk '$1 !~ /^(loop|sr|md|dm-|nbd|zd)/')
}

mapfile -t candidates < <(detect_disk)

if [[ -z "$DISK" ]]; then
  if [[ ${#candidates[@]} -eq 0 ]]; then
    cat >&2 <<'EOF'
ERROR: no candidate enclosure disk found.

The new TerraMaster enclosure is NOT visible to this host. Check, in order:
  1. Powered on and the RAID 1 array finished initialising (front LEDs).
  2. USB cable in a blue (USB 3) port directly on the box, not on a hub.
  3. `lsusb` shows a USB Mass Storage / UAS device.
  4. `lsblk` shows a new /dev/sdX (a 2 x 8TB RAID 1 enclosure reports ~7.3 TB).

On the box:   lsusb; lsblk -o NAME,SIZE,TRAN,MODEL
Also load the driver if the device appears but no disk does:
              sudo modprobe usb_storage uas
EOF
    echo >&2
    echo "Candidates that were considered:" >&2
    for c in "${candidates[@]}"; do echo "  $c" >&2; done
    exit 1
  fi

  if [[ ${#candidates[@]} -gt 1 ]]; then
    echo "ERROR: more than one candidate disk — pick one with --disk:" >&2
    for c in "${candidates[@]}"; do echo "  $c" >&2; done
    exit 1
  fi

  DISK="$(cut -f1 <<<"${candidates[0]}")"
  info "auto-detected enclosure: ${candidates[0]}"
else
  [[ -b "$DISK" ]] || die "$DISK is not a block device"
fi

# Guard: never touch a disk that backs the running system.
if is_system_disk "$(basename "$DISK")"; then
  die "$DISK backs the running system — refusing"
fi
if lsblk -rno MOUNTPOINT "$DISK" | grep -qx '/'; then
  die "$DISK is mounted at / — refusing"
fi

info "target disk: $DISK"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL "$DISK" | sed 's/^/    /'

# ---------------------------------------------------------------- link speed
# An 8 TB HDD behind a USB 2.0 link tops out around 35 MB/s, which turns a
# multi-hundred-GB restic run into hours. Warn loudly, do not fail.
if [[ "$(lsblk -dno TRAN "$DISK" | tr -d ' ')" == "usb" ]]; then
  link_mbps=""
  # /sys/block/sdX/device -> .../usbN/N-P/  (the device dir holds 'speed')
  devdir="$(readlink -f "/sys/block/$(basename "$DISK")/device" 2>/dev/null || true)"
  while [[ -n "$devdir" && "$devdir" != "/" ]]; do
    if [[ -f "$devdir/speed" ]]; then
      link_mbps="$(cat "$devdir/speed")"
      break
    fi
    devdir="$(dirname "$devdir")"
  done
  if [[ -n "$link_mbps" ]]; then
    info "USB link speed: ${link_mbps} Mb/s"
    if [[ "${link_mbps%%.*}" -lt 5000 ]]; then
      cat >&2 <<EOF
WARNING: the enclosure is linked at ${link_mbps} Mb/s, not 5000 Mb/s (USB 3).

  It is attached through a USB 2.0 hub:
$(lsusb -t | grep -B3 -A1 -i "mass storage" | sed 's/^/    /')

  Expected throughput is ~30-40 MB/s, so a large restic run will be slow.
  Recommend: move the cable to a USB 3 (blue) port and the TerraMaster hub to
  a USB 3 port too, then re-check with:  lsusb -t | grep -i "5000M"
EOF
    fi
  fi
fi

# ---------------------------------------------------------------- filesystem
current_fstype="$(lsblk -dno FSTYPE "$DISK" | tr -d ' ')"
current_label=""
current_uuid=""
if [[ -n "$current_fstype" ]]; then
  # blkid on the block device needs root; lsblk reads the same out of udev, so
  # a dry-run as a normal user still gets a real answer.
  current_label="$(lsblk -dno LABEL "$DISK" 2>/dev/null | tr -d ' ' || true)"
  current_uuid="$(lsblk -dno UUID "$DISK" 2>/dev/null | tr -d ' ' || true)"
  if [[ -z "$current_uuid" && "${EUID:-$(id -u)}" -eq 0 ]]; then
    current_uuid="$(blkid -s UUID -o value "$DISK" 2>/dev/null || true)"
  fi
fi

if [[ "$current_fstype" == "ext4" && "$DO_FORMAT" -eq 0 ]]; then
  info "already ext4 (label=${current_label:-none} uuid=${current_uuid:-unknown}) — keeping existing filesystem"
  info "(pass --format for a clean slate)"
elif [[ "$DO_FORMAT" -eq 1 ]]; then
  # Clean slate. A restic repo is append-only packs plus indexes; ext4 with
  # journaling and 4K blocks is right, but the defaults are tuned for a system
  # disk, not a 7 TB USB HDD backup volume:
  #   -m 0      no 5% root reserve (350 GB at -m 5 on 7 TB wasted on a data disk)
  #   -T large  ~1.6M inodes instead of a few hundred thousand
  #   -E lazy_itable_init=0,lazy_journal_init=0  fully zero the metadata now, so
  #             the first restic run doesn't race background e2fsck-ish init
  #   -O ^has_journal is NOT used: we want the journal for crash safety.
  info "CLEAN SLATE: will destroy the existing ${current_fstype:-empty} filesystem on $DISK"
  # Eager metadata init on a 7.3 TB volume writes a few GB before mkfs returns,
  # so expect a couple of minutes (longer on a 480 Mb/s USB 2.0 link). That is
  # one-off and buys a predictable first backup instead of lazy-init contention.
  info "mkfs will take a few minutes (eager inode/journal init on 7.3 TB) — this is normal"
  if [[ "$DRY_RUN" -eq 0 && "$YES" -eq 0 ]]; then
    echo
    echo "This ERASES $DISK (TerraMaster enclosure). Type exactly:  ERASE-$(basename "$DISK")"
    read -r -p "Confirm: " ans
    [[ "$ans" == "ERASE-$(basename "$DISK")" ]] || die "cancelled"
  fi
  run umount "$DISK" 2>/dev/null || true
  run umount "$MOUNT_POINT" 2>/dev/null || true
  run swapoff "$DISK" 2>/dev/null || true
  # Order matters: drop any partition table / fs signatures, then TRIM the whole
  # device if the bridge supports it, then write the fresh ext4.
  run sgdisk --zap-all "$DISK" 2>/dev/null || true
  run wipefs -a "$DISK"
  run blkdiscard -f "$DISK" 2>/dev/null || info "(blkdiscard unsupported on this USB bridge — skipping)"
  run mkfs.ext4 -m 0 -T large -E lazy_itable_init=0,lazy_journal_init=0 -L "$FS_LABEL" -F "$DISK"
  run udevadm settle
  current_fstype=ext4
  if [[ "$DRY_RUN" -eq 0 ]]; then
    current_uuid="$(lsblk -dno UUID "$DISK" | tr -d ' ')"
    [[ -n "$current_uuid" ]] || current_uuid="$(blkid -s UUID -o value "$DISK")"
  else
    current_uuid="<new-uuid-after-format>"
  fi
else
  if [[ -n "$current_fstype" ]]; then
    die "$DISK already carries a '${current_fstype}' filesystem (label=${current_label:-none}).
Refusing to format over data. To wipe it and start clean (this destroys it):
    sudo $0 ${DISK:+--disk $DISK} --format --yes"
  fi
  info "$DISK is empty — will create ext4"
  if [[ "$DRY_RUN" -eq 0 && "$YES" -eq 0 ]]; then
    echo
    read -r -p "Format $DISK as ext4 (label $FS_LABEL)? THIS ERASES IT. [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || die "cancelled"
  fi
  run mkfs.ext4 -m 0 -T large -E lazy_itable_init=0,lazy_journal_init=0 -L "$FS_LABEL" -F "$DISK"
  run udevadm settle
  current_uuid="$(lsblk -dno UUID "$DISK" | tr -d ' ')"
  [[ -n "$current_uuid" ]] || current_uuid="$(blkid -s UUID -o value "$DISK")"
fi

[[ -n "$current_uuid" ]] || die "could not read UUID of $DISK"
info "uuid: $current_uuid"

# ---------------------------------------------------------------- mount
run mkdir -p "$MOUNT_POINT"

if findmnt -no SOURCE -T "$MOUNT_POINT" 2>/dev/null | grep -qx "$DISK"; then
  info "$MOUNT_POINT already mounted from $DISK"
else
  fstab_line="UUID=$current_uuid  $MOUNT_POINT  ext4  defaults,noatime,nofail,x-systemd.device-timeout=30  0  2"
  if grep -qE "^[^#].*[[:space:]]${MOUNT_POINT}[[:space:]]" /etc/fstab; then
    if [[ "$DO_FORMAT" -eq 1 && "$DRY_RUN" -eq 0 ]]; then
      # The reformat gave the fs a new UUID; the existing fstab line would point
      # at the old, now-nonexistent UUID. Rewrite that line in place.
      info "/etc/fstab had an entry for $MOUNT_POINT — replacing it with the new UUID"
      cp -a /etc/fstab "/etc/fstab.bak-$(date +%Y%m%d-%H%M%S)"
      awk -v mnt="$MOUNT_POINT" -v line="$fstab_line" '
        $0 !~ /^#/ && $2 == mnt { print line; next }
        { print }
      ' /etc/fstab > /etc/fstab.tmp
      mv /etc/fstab.tmp /etc/fstab
      grep -nE "[[:space:]]${MOUNT_POINT}[[:space:]]" /etc/fstab | sed 's/^/    /'
    else
      info "/etc/fstab already has an entry for $MOUNT_POINT — leaving it alone"
      grep -nE "^[^#].*[[:space:]]${MOUNT_POINT}[[:space:]]" /etc/fstab | sed 's/^/    /'
    fi
  else
    info "adding fstab entry"
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "  DRY-RUN append to /etc/fstab: $fstab_line"
    else
      cp -a /etc/fstab "/etc/fstab.bak-$(date +%Y%m%d-%H%M%S)"
      printf '\n# External TerraMaster enclosure (2x8TB RAID 1) — restic repo\n%s\n' "$fstab_line" >> /etc/fstab
    fi
  fi
  run systemctl daemon-reload
  run mount "$MOUNT_POINT"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  findmnt -T "$MOUNT_POINT" | sed 's/^/    /'
  src="$(findmnt -no SOURCE -T "$MOUNT_POINT")"
  [[ "$src" == "$DISK" ]] || die "$MOUNT_POINT is NOT mounted from $DISK (got '$src')"
  avail="$(df -BG --output=avail "$MOUNT_POINT" | tail -1 | tr -dc '0-9')"
  info "free space on $MOUNT_POINT: ${avail}G"
  [[ "${avail:-0}" -gt 100 ]] || die "$MOUNT_POINT has only ${avail}G free — refusing to host the repo"

  # This filesystem was already ext4 and carried the same UUID the old fstab
  # line pointed at, so it may hold data from before. Show it, never delete it.
  info "existing contents of $MOUNT_POINT:"
  # '|| true': a freshly formatted volume is empty, so the glob does not expand
  # and du exits non-zero — that must not kill the script under set -e.
  du -sh "$MOUNT_POINT"/* 2>/dev/null | sort -h | tail -20 | sed 's/^/    /' || true
  existing_repo="$MOUNT_POINT/$REPO_SUBDIR"
  if [[ -f "$existing_repo/config" ]]; then
    info "a restic repo already exists at $existing_repo — will reuse it (not re-init)"
  fi
fi

# ---------------------------------------------------------------- repo
new_repo="$MOUNT_POINT/$REPO_SUBDIR"
old_repo="$OLD_FAKE/$REPO_SUBDIR"

run mkdir -p "$new_repo"
run chown "$APP_USER:$APP_USER" "$new_repo"
run chmod 700 "$new_repo"

if [[ "$SKIP_MIGRATE" -eq 0 && "$DO_FORMAT" -eq 0 ]]; then
  if [[ -d "$old_repo" && ! -f "$new_repo/config" ]]; then
    info "migrating existing repo $old_repo -> $new_repo"
    run rsync -aHAX --info=progress2 "$old_repo"/ "$new_repo"/
  elif [[ -f "$new_repo/config" ]]; then
    info "repo already present at $new_repo — nothing to migrate"
  elif [[ ! -d "$old_repo" ]]; then
    info "no existing repo at $old_repo — will init a fresh one"
  fi
elif [[ "$DO_FORMAT" -eq 1 ]]; then
  # Clean slate was requested, so do NOT copy the old snapshots onto the fresh
  # volume. They stay untouched at ~/TERRAMASTER/... for as long as you keep it.
  info "clean slate: NOT migrating old snapshots (they remain on the root disk)"
fi

if [[ "$DRY_RUN" -eq 0 && ! -f "$new_repo/config" ]]; then
  info "initialising new restic repo"
  # shellcheck disable=SC1090
  set -a; . "$BACKUP_ENV"; set +a
  run restic init --repo "$new_repo"
fi

# ---------------------------------------------------------------- env file
if [[ "$DRY_RUN" -eq 0 ]]; then
  if grep -q '^export RESTIC_REPOSITORY=' "$BACKUP_ENV"; then
    cp -a "$BACKUP_ENV" "$BACKUP_ENV.bak-$(date +%Y%m%d-%H%M%S)"
    info "repointing RESTIC_REPOSITORY in $BACKUP_ENV"
    # Write via a temp file so the line is replaced in place, no sed -i races.
    awk -v repo="$new_repo" '
      /^export RESTIC_REPOSITORY=/ { print "export RESTIC_REPOSITORY=\"" repo "\""; next }
      { print }
    ' "$BACKUP_ENV" > "$BACKUP_ENV.tmp"
    chmod 600 "$BACKUP_ENV.tmp"
    chown "$APP_USER:$APP_USER" "$BACKUP_ENV.tmp"
    mv "$BACKUP_ENV.tmp" "$BACKUP_ENV"
    grep -n '^export RESTIC_REPOSITORY=' "$BACKUP_ENV" | sed 's/^/    /'
  else
    info "WARNING: no RESTIC_REPOSITORY line in $BACKUP_ENV — set it manually to $new_repo"
  fi
fi

# ---------------------------------------------------------------- nightly guard
# The old guard was `[[ -d /home/lawsen0/TERRAMASTER ]]`, which always passed
# because it was a plain dir on /. Replace it with a real mount check.
if [[ "$DRY_RUN" -eq 0 && -f "$NIGHTLY" ]]; then
  if grep -q 'findmnt -T' "$NIGHTLY"; then
    info "nightly guard already mount-aware"
  else
    cp -a "$NIGHTLY" "$NIGHTLY.bak-$(date +%Y%m%d-%H%M%S)"
    info "hardening mount guard in $NIGHTLY"
    python3 - "$NIGHTLY" "$MOUNT_POINT" <<'PY'
import re, sys
path, mnt = sys.argv[1], sys.argv[2]
src = open(path).read()
old_guard = re.search(
    r'# fail fast if TerraMaster not mounted.*?\nfi\n', src, re.S)
new_guard = f'''# fail fast if the external TerraMaster enclosure is not really mounted
if ! findmnt -no SOURCE -T "{mnt}" >/dev/null 2>&1 \\
   || [[ "$(findmnt -no SOURCE -T "{mnt}")" == "$(findmnt -no SOURCE -T /)" ]]; then
    echo "[backup:$HOST_TAG] ERROR: {mnt} is not a mounted external disk"
    exit 1
fi
if [[ ! -d "{mnt}" ]]; then
    echo "[backup:$HOST_TAG] ERROR: {mnt} does not exist"
    exit 1
fi
'''
if old_guard:
    src = src[:old_guard.start()] + new_guard + src[old_guard.end():]
else:
    sys.stderr.write("guard block not found — edit manually\n")
    sys.exit(1)
src = src.replace("/home/lawsen0/TERRAMASTER", mnt)
open(path, "w").write(src)
PY
  fi
fi

# ---------------------------------------------------------------- retire fake dir
# Only retire it when the snapshots were actually migrated. With --format we
# deliberately did NOT copy them, so ~/TERRAMASTER is the only remaining copy
# of that history and must stay put.
if [[ "$DRY_RUN" -eq 0 && -d "$OLD_FAKE" && "$SKIP_MIGRATE" -eq 0 && "$DO_FORMAT" -eq 0 ]]; then
  retired="$OLD_FAKE-fake-OLD"
  if [[ -d "$retired" ]]; then
    info "old fake dir already retired at $retired — leaving the copy in place"
  else
    info "retiring fake NAS dir $OLD_FAKE -> $retired (kept as a fallback copy)"
    run mv "$OLD_FAKE" "$retired"
  fi
elif [[ "$DRY_RUN" -eq 0 && "$DO_FORMAT" -eq 1 && -d "$OLD_FAKE" ]]; then
  info "leaving $OLD_FAKE in place — it still holds the previous 30 snapshots"
  info "delete it yourself once you are confident in the new volume"
fi

# ---------------------------------------------------------------- verify
if [[ "$DRY_RUN" -eq 0 ]]; then
  echo
  info "verifying repo"
  # shellcheck disable=SC1090
  set -a; . "$BACKUP_ENV"; set +a
  restic snapshots --latest 3
  echo
  info "done. Repo now lives on $new_repo"
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [[ -x "$REPO_ROOT/scripts/install-ubuntu-backup-scripts.sh" ]]; then
    bash "$REPO_ROOT/scripts/install-ubuntu-backup-scripts.sh" "$(dirname "$NIGHTLY")"
  elif [[ ! -x "$ENCLOSURE_POWER" ]]; then
    info "Copy scripts/ubuntu-backups/*.sh to $(dirname "$NIGHTLY") (install-ubuntu-backup-scripts.sh)"
  fi
  info "Run 'backupnightly' to add a snapshot, 'showrestic' to inspect."
  info "Nightly job wakes the enclosure before backup and powers it off after success."
else
  echo
  info "dry run complete — nothing changed"
fi
