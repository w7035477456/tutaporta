#!/usr/bin/env bash
# Remote deploy from Mac: same git + febeprod path as interactive work2() on Ubuntu.
# BRANCH must be set by caller (deployall2 / deploy-all.sh).
set -euo pipefail
shopt -s expand_aliases

: "${BRANCH:?BRANCH not set}"
REPO="${REPO:-$HOME/code/main}"
GIT_KEY="${UBUNTU_GIT_KEY:-$HOME/.ssh/corruptedKey_march2023}"

cd "$REPO" || exit 1

# Same GitHub key as work2 (~/.ssh/config → corruptedKey_march2023). IdentitiesOnly = never githubkey.
export GIT_SSH_COMMAND="ssh -o IdentitiesOnly=yes -i ${GIT_KEY}"

echo "=== git fetch (corruptedKey_march2023, same as work2) ==="
git fetch origin
git pull 2>/dev/null || true

echo "--------------------------------"
git branch
echo "--------------------------------"

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
        git checkout "$BRANCH"
    else
        git checkout -b "$BRANCH" "origin/$BRANCH"
    fi
    git reset --hard "origin/$BRANCH"
else
    git checkout "$BRANCH"
fi

echo -e "\n____BRANCH COMMENT:_________________"
git log -1 --pretty=%s
echo -e "_______________________________________\n"

# Same bash init work2 uses on Ubuntu (~/b, not Mac myscript path over SSH from Mac).
if [[ ! -f "$HOME/b" ]]; then
    echo "ERROR: missing $HOME/b — run: cp $REPO/myscript/ubuntu/b ~/b" >&2
    exit 1
fi
# shellcheck source=/dev/null
source "$HOME/b"

febeprod
git branch

if [[ -f "$REPO/scripts/deployIntegrity.mjs" ]]; then
    node "$REPO/scripts/deployIntegrity.mjs" verify
    node "$REPO/fe/scripts/print-build-info.mjs" 2>/dev/null | sed 's/^/Build stamp: /'
fi
