#!/usr/bin/env bash
# Start LLM Gateway in the FOREGROUND (Ctrl+C to stop). For background: llm-gateway-start-bg.sh
# Usage: ./scripts/llm-gateway-start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
if ! ai_model_enabled; then
  echo "AI_MODEL_ENABLE=${AI_MODEL_ENABLE} — not starting LLM Gateway"
  exit 0
fi

"$ROOT/scripts/llm-gateway-build.sh"

# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
export RAG_HOST="${RAG_HOST:-127.0.0.1}"
export RAG_PORT="${RAG_PORT:-8765}"

cd "$ROOT/rag_service"
# shellcheck disable=SC1091
source .venv/bin/activate

echo "Starting TutaMall LLM Gateway on http://${RAG_HOST}:${RAG_PORT}"
echo "  Ollama: ${OLLAMA_BASE_URL}  model: ${OLLAMA_MODEL}"
echo "  auth:   $([ -n "${LLM_GATEWAY_SECRET:-}" ] && echo 'X-LLM-Gateway-Key required' || echo 'open (LLM_GATEWAY_SECRET unset)')"
echo "  APIs:   GET /health  POST /chat  POST /query-notes  POST /keep-model"
exec uvicorn main:app --host "$RAG_HOST" --port "$RAG_PORT" --reload
