#!/usr/bin/env bash
# Start (or restart) the LLM Gateway in the background.
# Ensures Ollama is up and the model is pulled, then waits for /health.
# Log: rag_service/llm-gateway.log   Skip auto-pull: RAG_SKIP_PULL=1
# Usage: ./scripts/llm-gateway-start-bg.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
if ! ai_model_enabled; then
  echo "[llm-gw] AI_MODEL_ENABLE=${AI_MODEL_ENABLE} — skipping Ollama + LLM Gateway start"
  exit 0
fi
# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
RAG_PORT="${RAG_PORT:-8765}"
LOG="$ROOT/rag_service/llm-gateway.log"
# Keep legacy log name in sync for anyone still tailing rag.log
LEGACY_LOG="$ROOT/rag_service/rag.log"

echo "[llm-gw] model: ${OLLAMA_MODEL}  ollama: ${OLLAMA_BASE_URL}  port: ${RAG_PORT}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[llm-gw] FAIL: ollama CLI not installed" >&2
  exit 1
fi

ollama_up() { curl -sf -m 3 "${OLLAMA_BASE_URL}/api/tags" >/dev/null; }

if ! ollama_up; then
  echo "[llm-gw] Ollama not responding — starting it ..."
  if [[ "$(uname)" == "Darwin" ]]; then
    open -a Ollama 2>/dev/null || (nohup ollama serve >"$ROOT/rag_service/ollama.log" 2>&1 </dev/null &)
  else
    sudo -n systemctl start ollama 2>/dev/null || (nohup ollama serve >"$ROOT/rag_service/ollama.log" 2>&1 </dev/null &)
  fi
  for _ in $(seq 1 30); do
    ollama_up && break
    sleep 1
  done
  if ! ollama_up; then
    echo "[llm-gw] FAIL: Ollama did not start" >&2
    exit 1
  fi
fi

if ! ollama show "$OLLAMA_MODEL" >/dev/null 2>&1; then
  if [[ "${RAG_SKIP_PULL:-}" == "1" ]]; then
    echo "[llm-gw] FAIL: model ${OLLAMA_MODEL} not installed (RAG_SKIP_PULL=1)" >&2
    exit 1
  fi
  echo "[llm-gw] model ${OLLAMA_MODEL} not installed — pulling (large download, first time only) ..."
  ollama pull "$OLLAMA_MODEL" || { echo "[llm-gw] FAIL: ollama pull ${OLLAMA_MODEL}" >&2; exit 1; }
fi

"$ROOT/scripts/llm-gateway-stop.sh" >/dev/null 2>&1 || true
sleep 1

"$ROOT/scripts/llm-gateway-build.sh" || exit 1

cd "$ROOT" || exit 1
: >"$LOG"
ln -sfn "$(basename "$LOG")" "$LEGACY_LOG" 2>/dev/null || cp /dev/null "$LEGACY_LOG" 2>/dev/null || true
nohup ./scripts/llm-gateway-start.sh >"$LOG" 2>&1 </dev/null &
disown 2>/dev/null || true

health=""
for _ in $(seq 1 120); do
  health="$(curl -sf -m 3 "http://127.0.0.1:${RAG_PORT}/health" 2>/dev/null || true)"
  [[ -n "$health" ]] && break
  sleep 1
done

if [[ -z "${health:-}" ]]; then
  echo "[llm-gw] FAIL: gateway did not answer /health — see $LOG" >&2
  tail -30 "$LOG" >&2
  exit 1
fi

printf '%s' "$health" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("[llm-gw] status=%s service=%s model_ready=%s auth_required=%s configured_model=%s" % (
    d.get("status"), d.get("service"), d.get("model_ready"), d.get("auth_required"),
    (d.get("ollama") or {}).get("configured_model")))
sys.exit(0 if d.get("model_ready") else 1)
'
echo "[llm-gw] log: $LOG"
