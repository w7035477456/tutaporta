#!/usr/bin/env bash
# Start (or restart) the TutaNotes RAG service in the background — Mac beall / Ubuntu febeprod.
# Model = OLLAMA_MODEL from ~/.ssh/be/.env (default in rag-default-model.sh).
# Ensures Ollama is up and the model is pulled, then waits for /health.
# Log: rag_service/rag.log   Skip auto-pull: RAG_SKIP_PULL=1
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
if ! ai_model_enabled; then
  echo "[rag-bg] AI_MODEL_ENABLE=${AI_MODEL_ENABLE} — skipping Ollama + AI model start"
  exit 0
fi
# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
RAG_PORT="${RAG_PORT:-8765}"
LOG="$ROOT/rag_service/rag.log"

echo "[rag-bg] model: ${OLLAMA_MODEL}  ollama: ${OLLAMA_BASE_URL}  port: ${RAG_PORT}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[rag-bg] FAIL: ollama CLI not installed" >&2
  exit 1
fi

ollama_up() { curl -sf -m 3 "${OLLAMA_BASE_URL}/api/tags" >/dev/null; }

if ! ollama_up; then
  echo "[rag-bg] Ollama not responding — starting it ..."
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
    echo "[rag-bg] FAIL: Ollama did not start" >&2
    exit 1
  fi
fi

if ! ollama show "$OLLAMA_MODEL" >/dev/null 2>&1; then
  if [[ "${RAG_SKIP_PULL:-}" == "1" ]]; then
    echo "[rag-bg] FAIL: model ${OLLAMA_MODEL} not installed (RAG_SKIP_PULL=1)" >&2
    exit 1
  fi
  echo "[rag-bg] model ${OLLAMA_MODEL} not installed — pulling (large download, first time only) ..."
  ollama pull "$OLLAMA_MODEL" || { echo "[rag-bg] FAIL: ollama pull ${OLLAMA_MODEL}" >&2; exit 1; }
fi

# Stop any running RAG service (foreground startaimodel/startOlama included) so it reloads .env.
pkill -f "uvicorn main:app" 2>/dev/null || true
if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti "tcp:${RAG_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
fi
sleep 1

cd "$ROOT" || exit 1
nohup ./scripts/start-rag-service.sh >"$LOG" 2>&1 </dev/null &
disown 2>/dev/null || true

for _ in $(seq 1 120); do
  health="$(curl -sf -m 3 "http://127.0.0.1:${RAG_PORT}/health" 2>/dev/null || true)"
  [[ -n "$health" ]] && break
  sleep 1
done

if [[ -z "${health:-}" ]]; then
  echo "[rag-bg] FAIL: RAG service did not answer /health — see $LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi

printf '%s' "$health" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("[rag-bg] status=%s configured_model=%s model_ready=%s" % (
    d.get("status"), (d.get("ollama") or {}).get("configured_model"), d.get("model_ready")))
sys.exit(0 if d.get("model_ready") else 1)
'
