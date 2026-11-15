#!/usr/bin/env bash
# Build (create/refresh) the LLM Gateway Python venv + deps. Idempotent.
# Usage: ./scripts/llm-gateway-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/rag_service"

if ! command -v python3 >/dev/null 2>&1; then
  echo "FAIL: python3 not found" >&2
  exit 1
fi

if [[ ! -f .venv/bin/activate ]]; then
  if [[ -d .venv ]]; then
    echo "Removing incomplete rag_service/.venv ..."
    rm -rf .venv
  fi
  echo "Creating Python venv in rag_service/.venv ..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "OK: LLM Gateway venv ready ($(python -V 2>&1))"
echo "    path: $ROOT/rag_service/.venv"
echo "    next: ./scripts/llm-gateway-start-bg.sh   # or llm-gateway-start.sh (foreground)"
