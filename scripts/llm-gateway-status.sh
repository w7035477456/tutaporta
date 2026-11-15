#!/usr/bin/env bash
# Status of the LLM Gateway + Ollama.
# Usage: ./scripts/llm-gateway-status.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"

RAG_HOST="${RAG_HOST:-127.0.0.1}"
RAG_PORT="${RAG_PORT:-8765}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
GATEWAY_URL="${LLM_GATEWAY_URL:-${RAG_SERVICE_URL:-http://${RAG_HOST}:${RAG_PORT}}}"
GATEWAY_URL="${GATEWAY_URL%/}"

echo "=== LLM Gateway status ==="
echo "gateway_url:  ${GATEWAY_URL}"
echo "ollama_url:   ${OLLAMA_BASE_URL}"
echo "model:        ${OLLAMA_MODEL}"
echo "auth_secret:  $([ -n "${LLM_GATEWAY_SECRET:-}" ] && echo set || echo unset)"
echo

# Port listener
if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti "tcp:${RAG_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "listen:       port ${RAG_PORT} pid(s) ${pids}"
  else
    echo "listen:       nothing on port ${RAG_PORT}"
  fi
fi

health="$(curl -sf -m 5 "${GATEWAY_URL}/health" 2>/dev/null || true)"
if [[ -z "$health" ]]; then
  echo "health:       UNREACHABLE"
  echo
  echo "Start with: ./scripts/llm-gateway-start-bg.sh"
  exit 1
fi

printf '%s' "$health" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("health:       %s" % d.get("status"))
print("service:      %s v%s" % (d.get("service"), d.get("version")))
print("model_ready:  %s" % d.get("model_ready"))
print("auth_required:%s" % d.get("auth_required"))
ollama = d.get("ollama") or {}
print("configured:   %s" % ollama.get("configured_model"))
models = ollama.get("models") or []
print("ollama_models:%s" % (", ".join(models[:8]) + (" …" if len(models) > 8 else "")))
if d.get("error"):
    print("error:        %s" % d.get("error"))
sys.exit(0 if d.get("status") in ("ok", "degraded") else 1)
'
