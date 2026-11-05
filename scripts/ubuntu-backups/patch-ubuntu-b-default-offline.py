#!/usr/bin/env python3
"""Patch lawsen0 ~/b for wake→restic→sleep and multi-command restic sessions. Idempotent."""
from pathlib import Path
import re
import sys

B = Path.home() / "b"
text = B.read_text()

HELPER = """
_terramaster_restic_begin() { export TERRAMASTER_KEEP_AWAKE=1; }
_terramaster_restic_end() {
    unset TERRAMASTER_KEEP_AWAKE
    sudo ~/backups/scripts/terramaster-enclosure-power.sh sleep 2>/dev/null || true
}
"""

SHOWRESTIC_FN = """
showrestic() {
    clear
    sudo ~/backups/scripts/terramaster-enclosure-power.sh wake || return $?
    sudo -E bash -c "source ~/backups/.backup-secrets-ubuntu.env; restic check; restic snapshots; restic ls latest"
    local rc=$?
    sudo ~/backups/scripts/terramaster-enclosure-power.sh sleep 2>/dev/null || true
    return $rc
}
"""

RESTICU_FN = """
resticu() {
    sudo ~/backups/scripts/terramaster-enclosure-power.sh wake || return $?
    sudo bash -c 'source "$1"; shift; restic "$@"' _ "$RESTIC_ENV_UBUNTU" "$@"
    local rc=$?
    if [[ -z "${TERRAMASTER_KEEP_AWAKE:-}" ]]; then
        sudo ~/backups/scripts/terramaster-enclosure-power.sh sleep 2>/dev/null || true
    fi
    return $rc
}
"""


def ensure_helpers():
    global text
    if "_terramaster_restic_begin" in text:
        return
    anchor = "RESTIC_ENV_UBUNTU=/home/lawsen0/backups/.backup-secrets-ubuntu.env"
    if anchor not in text:
        sys.exit("anchor RESTIC_ENV_UBUNTU not found in ~/b")
    text = text.replace(anchor, anchor + "\n" + HELPER.strip() + "\n", 1)


def replace_showrestic():
    global text
    if "showrestic() {" in text:
        text = re.sub(
            r"showrestic\(\) \{[^}]*\}\n",
            SHOWRESTIC_FN.strip() + "\n",
            text,
            count=1,
            flags=re.DOTALL,
        )
        return
    old = "alias showrestic='sudo ~/backups/scripts/terramaster-enclosure-power.sh wake; clear;sudo -E bash -c \"source ~/backups/.backup-secrets-ubuntu.env; restic check; restic snapshots; restic ls latest\"'"
    if old not in text:
        old2 = "alias showrestic='clear;sudo -E bash -c \"source ~/backups/.backup-secrets-ubuntu.env; restic check; restic snapshots; restic ls latest\"'"
        if old2 not in text:
            sys.exit("showrestic alias not found")
        text = text.replace(old2, SHOWRESTIC_FN.strip() + "\n", 1)
    else:
        text = text.replace(old, SHOWRESTIC_FN.strip() + "\n", 1)


def replace_resticu():
    global text
    if "TERRAMASTER_KEEP_AWAKE" in text and "resticu() {" in text:
        text = re.sub(
            r"resticu\(\) \{[^}]*\}\n",
            RESTICU_FN.strip() + "\n",
            text,
            count=1,
            flags=re.DOTALL,
        )
        return
    pat = re.compile(r"resticu\(\) \{.*?\n\}\n", re.DOTALL)
    if not pat.search(text):
        sys.exit("resticu() not found")
    text = pat.sub(RESTICU_FN.strip() + "\n", text, count=1)


def patch_restore_snapshot():
    global text
    if "RestoreSnapshot() {" not in text:
        return
    m = re.search(r"RestoreSnapshot\(\) \{(.*?)^\}", text, re.DOTALL | re.MULTILINE)
    if m and "_terramaster_restic_begin" in m.group(1):
        return
    text = re.sub(
        r"(RestoreSnapshot\(\) \{\n)",
        r"\1    _terramaster_restic_begin\n    trap '_terramaster_restic_end' EXIT\n",
        text,
        count=1,
    )


def patch_named_function(name: str):
    global text
    pat = re.compile(rf"({name}\(\) \{{\n)", re.MULTILINE)
    if not pat.search(text):
        return
    marker = f"{name}() {{"
    idx = text.find(marker)
    if idx < 0:
        return
    chunk = text[idx : idx + 400]
    if "_terramaster_restic_begin" in chunk:
        return
    text = pat.sub(r"\1    _terramaster_restic_begin\n    trap '_terramaster_restic_end' EXIT\n", text, count=1)


def main():
    global text
    ensure_helpers()
    replace_showrestic()
    replace_resticu()
    patch_named_function("resticdiff")
    patch_named_function("resticsizes")
    patch_restore_snapshot()
    B.write_text(text)
    print("patched", B)


if __name__ == "__main__":
    main()
