#!/usr/bin/env bash
# Compare ROOT_FOLDER storage trees: Mac (~/.ssh/be/.env) vs Ubuntu (SSH + remote .env).
#
# Compares structure (relative dirs + non-meta file paths) and meta file contents
# (vault.meta.json / *.meta.json). Does NOT require byte-identical data blobs (.enc, images).
#
# First stdout line is always "same" or "difference". On difference a report follows.
# --quiet = first line only. --verbose = stderr summary + short diff snippets.
#
# Uses the same SSH as Mac f0/f2 (port 59221 + ~/.ssh/xbox2.pem via deploy-ssh-mac.sh).
#
#   isfoldersame
#   isfoldersame --quiet
#   isfoldersame --verbose
#
# Mac ~/b:
#   alias isfoldersame='$HOME/code/main/scripts/compare-storage-folders.sh'
#
# Exit codes: 0 = same, 1 = difference, 2 = error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UBUNTU_HOST="${COMPARE_FOLDER_UBUNTU_HOST:-lawsen0@192.168.222.200}"
SSH_BIN="${COMPARE_FOLDER_SSH_BIN:-${SCRIPT_DIR}/deploy-ssh-mac.sh}"
BE_ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
VERBOSE=0
QUIET=0

usage() {
  cat <<'EOF'
compare-storage-folders.sh [--ubuntu-host user@host] [--quiet] [--verbose]

Compares Mac vs Ubuntu ROOT_FOLDER subtrees (FAST + LARGE under ROOT_FOLDER).
"same" means matching directory tree, matching non-meta file paths, and matching
meta file contents (vault.meta.json / *.meta.json). Data file bytes are ignored.

Skips: logFolder/, .chunked-uploads/, .DS_Store, AppleDouble (._*).

SSH: same as f0/f2 — deploy-ssh-mac.sh (port 59221, ~/.ssh/xbox2.pem).

Environment:
  COMPARE_FOLDER_UBUNTU_HOST   SSH target (default lawsen0@192.168.222.200)
  COMPARE_FOLDER_CHECK_VPN     1 = run checkVpn first if available (default 1)
  BE_ENV_FILE                  Mac env file (default ~/.ssh/be/.env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ubuntu-host) UBUNTU_HOST="${2:-}"; shift 2 ;;
    --verbose|-v) VERBOSE=1; shift ;;
    --quiet|-q) QUIET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; echo "difference"; exit 2 ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
  echo "difference"
  exit 2
}

maybe_check_vpn() {
  [[ "${COMPARE_FOLDER_CHECK_VPN:-1}" == "1" ]] || return 0
  if declare -f checkVpn >/dev/null 2>&1; then
    checkVpn
    return $?
  fi
  if command -v checkVpn >/dev/null 2>&1; then
    checkVpn
    return $?
  fi
  return 0
}

run_ssh() {
  maybe_check_vpn || fail "VPN check failed (source ~/b and ensure VPN is up, same as f0/f2)"
  [[ -x "$SSH_BIN" || -f "$SSH_BIN" ]] || fail "SSH helper missing: $SSH_BIN"
  "$SSH_BIN" -o ConnectTimeout=25 "$UBUNTU_HOST" "$@"
}

read_env_val() {
  local file="$1" key="$2"
  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$file" \
    | tail -n1 \
    | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

[[ -n "$UBUNTU_HOST" ]] || fail "--ubuntu-host required"
[[ -r "$BE_ENV_FILE" ]] || fail "cannot read Mac env: $BE_ENV_FILE"

MAC_ROOT="$(read_env_val "$BE_ENV_FILE" ROOT_FOLDER)"
[[ -n "$MAC_ROOT" ]] || fail "ROOT_FOLDER missing in $BE_ENV_FILE"
[[ -d "$MAC_ROOT" ]] || fail "Mac ROOT_FOLDER not a directory: $MAC_ROOT"

TMPDIR="${TMPDIR:-/tmp}"
MAC_INV="$(mktemp "${TMPDIR}/pgsfolder_mac.XXXXXX")"
UBUNTU_INV="$(mktemp "${TMPDIR}/pgsfolder_ubuntu.XXXXXX")"
MAC_META="$(mktemp "${TMPDIR}/pgsfolder_mac_meta.XXXXXX")"
UBUNTU_META="$(mktemp "${TMPDIR}/pgsfolder_ubuntu_meta.XXXXXX")"
REPORT="$(mktemp "${TMPDIR}/pgsfolder_report.XXXXXX")"
cleanup() { rm -f "$MAC_INV" "$UBUNTU_INV" "$MAC_META" "$UBUNTU_META" "$REPORT"; }
trap cleanup EXIT

# Inventory builder (stdin unused). Args: ROOT. Prints sorted lines:
#   D\t<relpath>                 directory
#   F\t<relpath>                 non-meta file (path only; bytes ignored)
# Meta files go to a separate stream on fd 3 as: <relpath>\t<sha256>
# shellcheck disable=SC2016
build_inventory() {
  local root="$1"
  root="${root%/}"
  (
    cd "$root" || exit 1
    # Directories (skip volatile / junk)
    find . -type d \
      ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder' \
      ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder/*' \
      ! -path '*/.chunked-uploads' \
      ! -path '*/.chunked-uploads/*' \
      ! -path '*/.DS_Store' \
      2>/dev/null \
      | sed 's|^\./||' | sed '/^$/d' \
      | LC_ALL=C sort -u \
      | awk '{ print "D\t" $0 }'

    # Files
    find . -type f \
      ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder/*' \
      ! -path '*/.chunked-uploads/*' \
      ! -name '.DS_Store' \
      ! -name '._*' \
      2>/dev/null \
      | sed 's|^\./||' \
      | LC_ALL=C sort -u \
      | while IFS= read -r rel || [[ -n "$rel" ]]; do
          case "$rel" in
            */vault.meta.json|*.meta.json)
              # path + content hash for meta
              if command -v shasum >/dev/null 2>&1; then
                sum="$(shasum -a 256 -- "$rel" 2>/dev/null | awk '{print $1}')"
              else
                sum="$(sha256sum -- "$rel" 2>/dev/null | awk '{print $1}')"
              fi
              printf 'M\t%s\t%s\n' "$rel" "${sum:-MISSING}"
              ;;
            *)
              printf 'F\t%s\n' "$rel"
              ;;
          esac
        done
  )
}

build_inventory "$MAC_ROOT" >"$MAC_INV" || fail "Mac inventory failed under $MAC_ROOT"

# Ubuntu: resolve ROOT from remote .env, run same inventory, stream back
UBUNTU_ROOT="$(
  run_ssh 'bash -s' <<'REMOTE'
set -euo pipefail
envf="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
[[ -r "$envf" ]] || { echo "ERROR: cannot read $envf" >&2; exit 2; }
root="$(sed -n 's/^[[:space:]]*ROOT_FOLDER[[:space:]]*=[[:space:]]*//p' "$envf" | tail -n1 | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')"
[[ -n "$root" ]] || { echo "ERROR: ROOT_FOLDER missing in $envf" >&2; exit 2; }
[[ -d "$root" ]] || { echo "ERROR: ROOT_FOLDER not a directory: $root" >&2; exit 2; }
printf '%s\n' "$root"
REMOTE
)" || fail "could not read Ubuntu ROOT_FOLDER"
UBUNTU_ROOT="${UBUNTU_ROOT//$'\r'/}"
# SSH may print profile noise; take last non-empty line
UBUNTU_ROOT="$(printf '%s\n' "$UBUNTU_ROOT" | awk 'NF{line=$0} END{print line}')"
[[ -n "$UBUNTU_ROOT" ]] || fail "empty Ubuntu ROOT_FOLDER"

run_ssh "bash -s -- $(printf '%q' "$UBUNTU_ROOT")" <<'REMOTE' >"$UBUNTU_INV" || fail "Ubuntu inventory failed"
set -euo pipefail
root="${1%/}"
cd "$root" || exit 1
find . -type d \
  ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder' \
  ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder/*' \
  ! -path '*/.chunked-uploads' \
  ! -path '*/.chunked-uploads/*' \
  ! -path '*/.DS_Store' \
  2>/dev/null \
  | sed 's|^\./||' | sed '/^$/d' \
  | LC_ALL=C sort -u \
  | awk '{ print "D\t" $0 }'
find . -type f \
  ! -path './tutamallStorageFolder_largecheapstorage_outdatedOct2021/logFolder/*' \
  ! -path '*/.chunked-uploads/*' \
  ! -name '.DS_Store' \
  ! -name '._*' \
  2>/dev/null \
  | sed 's|^\./||' \
  | LC_ALL=C sort -u \
  | while IFS= read -r rel || [[ -n "$rel" ]]; do
      case "$rel" in
        */vault.meta.json|*.meta.json)
          if command -v sha256sum >/dev/null 2>&1; then
            sum="$(sha256sum -- "$rel" 2>/dev/null | awk '{print $1}')"
          else
            sum="$(shasum -a 256 -- "$rel" 2>/dev/null | awk '{print $1}')"
          fi
          printf 'M\t%s\t%s\n' "$rel" "${sum:-MISSING}"
          ;;
        *)
          printf 'F\t%s\n' "$rel"
          ;;
      esac
    done
REMOTE

awk -F'\t' '$1=="M"{print $2 "\t" $3}' "$MAC_INV" | LC_ALL=C sort >"$MAC_META"
awk -F'\t' '$1=="M"{print $2 "\t" $3}' "$UBUNTU_INV" | LC_ALL=C sort >"$UBUNTU_META"
# Structure lines for cmp: D and F only (paths), plus M paths without hash for path presence
awk -F'\t' '$1=="D"||$1=="F"{print $1 "\t" $2} $1=="M"{print "M\t" $2}' "$MAC_INV" | LC_ALL=C sort >"${MAC_INV}.struct"
awk -F'\t' '$1=="D"||$1=="F"{print $1 "\t" $2} $1=="M"{print "M\t" $2}' "$UBUNTU_INV" | LC_ALL=C sort >"${UBUNTU_INV}.struct"
trap 'rm -f "$MAC_INV" "$UBUNTU_INV" "$MAC_META" "$UBUNTU_META" "$REPORT" "${MAC_INV}.struct" "${UBUNTU_INV}.struct"' EXIT

mac_dirs="$(awk -F'\t' '$1=="D"' "${MAC_INV}.struct" | wc -l | tr -d ' ')"
ubu_dirs="$(awk -F'\t' '$1=="D"' "${UBUNTU_INV}.struct" | wc -l | tr -d ' ')"
mac_files="$(awk -F'\t' '$1=="F"' "${MAC_INV}.struct" | wc -l | tr -d ' ')"
ubu_files="$(awk -F'\t' '$1=="F"' "${UBUNTU_INV}.struct" | wc -l | tr -d ' ')"
mac_metas="$(wc -l <"$MAC_META" | tr -d ' ')"
ubu_metas="$(wc -l <"$UBUNTU_META" | tr -d ' ')"

struct_same=0
meta_same=0
cmp -s "${MAC_INV}.struct" "${UBUNTU_INV}.struct" && struct_same=1
cmp -s "$MAC_META" "$UBUNTU_META" && meta_same=1

print_verbose_summary() {
  local result="$1"
  [[ "$VERBOSE" -eq 1 ]] || return 0
  echo "--- folder compare ---" >&2
  echo "  Mac ROOT:     $MAC_ROOT" >&2
  echo "  Ubuntu ROOT:  $UBUNTU_ROOT  (ssh $UBUNTU_HOST)" >&2
  echo "  dirs:         Mac $mac_dirs / Ubuntu $ubu_dirs" >&2
  echo "  data files:   Mac $mac_files / Ubuntu $ubu_files  (paths only; bytes ignored)" >&2
  echo "  meta files:   Mac $mac_metas / Ubuntu $ubu_metas  (content hashed)" >&2
  echo "  result:       $result" >&2
}

if [[ "$struct_same" -eq 1 && "$meta_same" -eq 1 ]]; then
  print_verbose_summary "same"
  echo "same"
  exit 0
fi

print_verbose_summary "difference"
echo "difference"

if [[ "$QUIET" -eq 0 ]]; then
  {
    echo
    echo "Mac vs Ubuntu ROOT_FOLDER — structure + meta (data bytes ignored)"
    echo "  Mac:    $MAC_ROOT"
    echo "  Ubuntu: $UBUNTU_ROOT"
    echo

    if [[ "$struct_same" -ne 1 ]]; then
      only_mac="$(comm -23 "${MAC_INV}.struct" "${UBUNTU_INV}.struct")"
      only_ubu="$(comm -13 "${MAC_INV}.struct" "${UBUNTU_INV}.struct")"
      echo "Only on Mac — missing on Ubuntu ($(printf '%s\n' "$only_mac" | sed '/^$/d' | wc -l | tr -d ' ')):"
      if [[ -z "${only_mac// }" ]]; then
        echo "  (none)"
      else
        printf '%s\n' "$only_mac" | head -80 | sed 's/^/  /'
        n="$(printf '%s\n' "$only_mac" | sed '/^$/d' | wc -l | tr -d ' ')"
        [[ "$n" -gt 80 ]] && echo "  … ($((n - 80)) more)"
      fi
      echo
      echo "Only on Ubuntu — not on Mac ($(printf '%s\n' "$only_ubu" | sed '/^$/d' | wc -l | tr -d ' ')):"
      if [[ -z "${only_ubu// }" ]]; then
        echo "  (none)"
      else
        printf '%s\n' "$only_ubu" | head -80 | sed 's/^/  /'
        n="$(printf '%s\n' "$only_ubu" | sed '/^$/d' | wc -l | tr -d ' ')"
        [[ "$n" -gt 80 ]] && echo "  … ($((n - 80)) more)"
      fi
      echo
    else
      echo "Structure (dirs + file paths): same"
      echo
    fi

    if [[ "$meta_same" -ne 1 ]]; then
      echo "Meta file content differences (path + sha256):"
      diff -u --label mac/meta --label ubuntu/meta "$MAC_META" "$UBUNTU_META" | head -120 || true
    else
      echo "Meta file contents: same"
    fi
  } | tee "$REPORT"
fi

exit 1
