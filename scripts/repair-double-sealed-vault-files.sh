#!/usr/bin/env bash
# Scan / repair double-sealed TutaNotes vault files under a member notes tree.
#
# Default root (override with first positional arg or NOTES_ROOT):
#   Mac:    ~/i/mac_storage/tutamallStorageFolder_largecheapstorage_outdatedOct2021/users/M485668/notes
#   Ubuntu: ~/i/ubuntu_storage/tutamallStorageFolder_largecheapstorage_outdatedOct2021/users/M485668/notes
#
# Dry-run (default):
#   scripts/repair-double-sealed-vault-files.sh
#   scripts/repair-double-sealed-vault-files.sh --note 115
#
# Apply (writes .enc after backup; only when 2nd decrypt + checksum match):
#   scripts/repair-double-sealed-vault-files.sh --apply
#   scripts/repair-double-sealed-vault-files.sh --apply --note 115
#
# If dry-run reports unrecoverable, the outer seal is today's TEMPKEY_TUTADRIVE key but the
# inner seal used a different key. Re-try with the member Encrypt Password (hidden prompt):
#   scripts/repair-double-sealed-vault-files.sh --note 115 --ask-password
#
# Still unrecoverable → pull the originals out of an older sealed backup (matched by checksum).
# Prefer a plaintext copy of the vault if you still have one (no password needed), e.g.:
#   scripts/repair-double-sealed-vault-files.sh --apply \
#     --from-plain-dir ~/mac_storage.orig/tutamallStorageFolder_largecheapstorage_outdatedOct2021/users/M485668/notes
# Or older TNBAK2 zips (Nov 15 first, then Nov 20) with --ask-password --from-backup …
#
# Reads TEMPKEY_TUTADRIVE from ~/.ssh/be/.env via be/loadEnv.js — never prints secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHEAP_TAIL="tutamallStorageFolder_largecheapstorage_outdatedOct2021/users/M485668/notes"
DEFAULT_NOTES=""
for candidate in \
  "${HOME}/i/ubuntu_storage/${CHEAP_TAIL}" \
  "${HOME}/i/mac_storage/${CHEAP_TAIL}" \
  "${HOME}/ubuntu_storage/${CHEAP_TAIL}" \
  "${HOME}/mac_storage/${CHEAP_TAIL}"; do
  if [[ -d "$candidate/TutaNotes" || -f "$candidate/TutaNotes/vault.meta.json" ]]; then
    DEFAULT_NOTES="$candidate"
    break
  fi
done
DEFAULT_NOTES="${DEFAULT_NOTES:-${HOME}/i/mac_storage/${CHEAP_TAIL}}"

NOTES_ROOT="${NOTES_ROOT:-}"
PASS_THROUGH=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      sed -n '2,27p' "$0"
      exit 0
      ;;
    --ask-password)
      read -r -s -p "TutaNotes Encrypt Password: " TUTANOTES_ENCRYPT_PASSWORD
      echo
      export TUTANOTES_ENCRYPT_PASSWORD
      PASS_THROUGH+=(--password-env TUTANOTES_ENCRYPT_PASSWORD)
      shift
      ;;
    --)
      shift
      PASS_THROUGH+=("$@")
      break
      ;;
    # Flags that take a value — keep the next argv with them (do not treat it as NOTES_ROOT).
    --singles|--note|--member|--mount|--backup-dir|--password-env|--salt-env|--key-env|--from-backup|--from-plain-dir)
      PASS_THROUGH+=("$1" "$2")
      shift 2
      ;;
    -*)
      PASS_THROUGH+=("$1")
      shift
      ;;
    *)
      if [[ -z "${NOTES_ROOT}" && -d "$1" ]]; then
        NOTES_ROOT="$1"
        shift
      else
        PASS_THROUGH+=("$1")
        shift
      fi
      ;;
  esac
done

NOTES_ROOT="${NOTES_ROOT:-$DEFAULT_NOTES}"
NOTES_ROOT="${NOTES_ROOT/#\~/$HOME}"

if [[ ! -d "$NOTES_ROOT" ]]; then
  echo "notes root not found: $NOTES_ROOT" >&2
  exit 1
fi

# Mount path expected by repair script = parent of TutaNotes/ (…/notes).
MOUNT="$NOTES_ROOT"
if [[ -d "$NOTES_ROOT/TutaNotes" ]]; then
  MOUNT="$NOTES_ROOT"
elif [[ "$(basename "$NOTES_ROOT")" == "TutaNotes" ]]; then
  MOUNT="$(dirname "$NOTES_ROOT")"
fi

if [[ ! -f "$MOUNT/TutaNotes/vault.meta.json" ]]; then
  echo "vault.meta.json not found under $MOUNT/TutaNotes" >&2
  exit 1
fi

# Member folder name → M485668; repair script wants id without the leading M.
MEMBER_DIR="$(basename "$(dirname "$MOUNT")")"
MEMBER_ID="${MEMBER_DIR#M}"
EXTRA=()
HAS_SINGLES=0
HAS_MEMBER=0
HAS_MOUNT=0
for a in "${PASS_THROUGH[@]+"${PASS_THROUGH[@]}"}"; do
  case "$a" in
    --singles) HAS_SINGLES=1 ;;
    --member) HAS_MEMBER=1 ;;
    --mount) HAS_MOUNT=1 ;;
  esac
done
if [[ "$HAS_MOUNT" -eq 0 ]]; then EXTRA+=(--mount "$MOUNT"); fi
if [[ "$HAS_MEMBER" -eq 0 && "$MEMBER_DIR" == M* ]]; then EXTRA+=(--member "$MEMBER_ID"); fi
if [[ "$HAS_SINGLES" -eq 0 && "$MEMBER_DIR" == "M485668" ]]; then EXTRA+=(--singles 66); fi

cd "$ROOT/be"
echo "NOTES mount: $MOUNT  member=$MEMBER_DIR"
exec node scripts/repairTutaNotesDoubleSealedAttachments.mjs "${EXTRA[@]}" "${PASS_THROUGH[@]+"${PASS_THROUGH[@]}"}"
