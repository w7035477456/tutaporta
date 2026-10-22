#!/usr/bin/env bash
# Show the append-only ~/.ssh/be/raffle_log.log: member raffles generated (action=generate) and
# /host actions (draw = winning number drawn, scan / code = winner verification).
#
#   scripts/raffle-log.sh                # table: when, number, code, member, event, host
#   scripts/raffle-log.sh -l             # long form: every field of every ticket
#   scripts/raffle-log.sh 271            # only lines containing "271" (number, code, email, event…)
#   scripts/raffle-log.sh -l V4JB        # filter + long form
#   scripts/raffle-log.sh ubuntu [...]   # from the Mac: read Ubuntu's log over deploy-ssh-mac.sh
#
# Override the file with RAFFLE_LOG=/path/to/raffle_log.log.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == ubuntu ]]; then
  shift
  args=""
  for a in "$@"; do args+=" $(printf '%q' "$a")"; done
  exec "$SCRIPT_DIR/deploy-ssh-mac.sh" "${UBUNTU_SSH_HOST:-lawsen0@192.168.222.202}" \
    "bash \$HOME/code/main/scripts/raffle-log.sh$args"
fi

LOG="${RAFFLE_LOG:-$HOME/.ssh/be/raffle_log.log}"
long=0
filter=""
for a in "$@"; do
  case "$a" in
    -l|--long) long=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) filter="$a" ;;
  esac
done

if [[ ! -s "$LOG" ]]; then
  echo "No raffle tickets logged yet ($LOG on $(hostname -s))."
  exit 0
fi

awk -F'\t' -v long="$long" -v filter="$filter" -v host="$(hostname -s)" -v logfile="$LOG" '
function val(key,   i, n) {
  for (i = 1; i <= NF; i++) {
    n = index($i, "=")
    if (n && substr($i, 1, n - 1) == key) return substr($i, n + 1)
  }
  return "-"
}
function cut(s, w) { return length(s) > w ? substr(s, 1, w - 1) "…" : s }
BEGIN {
  if (!long) {
    printf "%-25s %-8s %-6s %-10s %-15s %-9s %-18s %-30s %s\n", "when", "action", "number", "code", "result", "singles", "name", "event", "host"
    printf "%-25s %-8s %-6s %-10s %-15s %-9s %-18s %-30s %s\n", "----", "------", "------", "----", "------", "-------", "----", "-----", "----"
  }
}
filter != "" && index(tolower($0), tolower(filter)) == 0 { next }
{
  count++
  if (long) {
    printf "#%d\n", count
    for (i = 1; i <= NF; i++) {
      n = index($i, "=")
      if (n) printf "  %-25s %s\n", substr($i, 1, n - 1), substr($i, n + 1)
    }
    print ""
  } else {
    action = val("action"); if (action == "-") action = "generate"
    when = val("datetime"); if (when == "-") when = val("raffle_generate_datetime")
    number = val("raffle_number"); if (number == "-") number = val("winning_raffle_number")
    code = val("verification_code"); if (code == "-") code = val("raffle_generate_id")
    printf "%-25s %-8s %-6s %-10s %-15s %-9s %-18s %-30s %s\n",
      when, action, number, code, val("result"), val("singles_id"),
      cut(val("singles_fullname"), 18), cut(val("event_title"), 30), val("host_full_name")
  }
}
END { printf "%s%d row(s) in %s on %s\n", (long ? "" : "\n"), count, logfile, host }
' "$LOG"
