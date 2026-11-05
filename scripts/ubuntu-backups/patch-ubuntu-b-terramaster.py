#!/usr/bin/env python3
"""One-off patch for lawsen0 ~/b on Ubuntu (not myscript/ubuntu/b)."""
from pathlib import Path

path = Path.home() / "b"
text = path.read_text()

if "terramasterstatus()" in text:
    print("terramasterstatus already present — no change")
    raise SystemExit(0)

block = r"""alias waketerramaster='sudo ~/backups/scripts/terramaster-enclosure-power.sh wake'
alias spinterramaster='sudo ~/backups/scripts/terramaster-enclosure-power.sh sleep'
terramasterstatus() {
    local out status
    if ! out=$(sudo ~/backups/scripts/terramaster-enclosure-power.sh status 2>&1); then
        printf '%s\n' "$out" >&2
        return 1
    fi
    status=$(printf '%s\n' "$out" | sed -n 's/^enclosure status: \([^ (]*\).*/\1/p')
    case "$status" in
        active) printf 'TerraMaster enclosure: ACTIVE — disk spun up (using power)\n\n' ;;
        spun_down) printf 'TerraMaster enclosure: SPUN DOWN — on USB, motor parked\n\n' ;;
        offline) printf 'TerraMaster enclosure: OFFLINE — no block device (USB powered off)\n\n' ;;
        *) printf 'TerraMaster enclosure: (status unknown — details below)\n\n' ;;
    esac
    printf '%s\n' "$out"
}
"""

needle = (
    "alias backupnightly='clear; sudo ~/backups/scripts/backup-nightly.sh "
    "~/backups/.backup-secrets-ubuntu.env'"
)
if needle not in text:
    raise SystemExit("backupnightly line not found — manual edit needed")
text = text.replace(needle, needle + "\n" + block, 1)

help_needle = "To activate backup manually:         backupnightly\n"
help_insert = """To activate backup manually:         backupnightly
To wake restic disk (before restic): waketerramaster
To park / power-off restic disk:     spinterramaster
To show enclosure power/mount state: terramasterstatus
"""
if help_needle in text:
    restic_section = text.split("restichelp()")[1].split("EOF")[0]
    if "terramasterstatus" not in restic_section:
        text = text.replace(help_needle, help_insert, 1)

path.write_text(text)
print("Updated ~/b with waketerramaster, spinterramaster, terramasterstatus")
