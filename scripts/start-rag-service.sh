#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/rag_service"

if [[ ! -f .venv/bin/activate ]]; then
  if [[ -d .venv ]]; then
    echo "Removing incomplete rag_service/.venv (missing bin/activate) ..."
    rm -rf .venv
  fi
  echo "Creating Python venv in rag_service/.venv ..."
  python3 -m venv .venv
fi

if [[ ! -f .venv/bin/activate ]]; then
  echo "FAIL: could not create .venv — try manually:"
  echo "  cd $ROOT/rag_service && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
export RAG_HOST="${RAG_HOST:-127.0.0.1}"
export RAG_PORT="${RAG_PORT:-8765}"

echo "Starting TutaNotes RAG service on http://${RAG_HOST}:${RAG_PORT}"
echo "Ollama: ${OLLAMA_BASE_URL}  model: ${OLLAMA_MODEL}"
exec uvicorn main:app --host "$RAG_HOST" --port "$RAG_PORT" --reload
