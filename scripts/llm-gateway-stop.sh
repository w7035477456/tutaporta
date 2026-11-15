#!/usr/bin/env bash
# Stop the LLM Gateway (uvicorn on RAG_PORT, default 8765).
# Usage: ./scripts/llm-gateway-stop.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
RAG_PORT="${RAG_PORT:-8765}"

stopped=0

# Prefer killing whatever is listening on the gateway port.
if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti "tcp:${RAG_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    still="$(lsof -ti "tcp:${RAG_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$still" ]]; then
      # shellcheck disable=SC2086
      kill -9 $still 2>/dev/null || true
    fi
    stopped=1
  fi
fi

# Also match uvicorn started from rag_service (foreground --reload spawns a child).
if pkill -f "uvicorn main:app" 2>/dev/null; then
  stopped=1
fi
# Match start-rag-service / llm-gateway-start nohup wrappers if still around.
pkill -f "scripts/start-rag-service.sh" 2>/dev/null || true
pkill -f "scripts/llm-gateway-start.sh" 2>/dev/null || true

sleep 0.5
if command -v lsof >/dev/null 2>&1; then
  left="$(lsof -ti "tcp:${RAG_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$left" ]]; then
    echo "FAIL: port ${RAG_PORT} still in use by pid(s): $left" >&2
    exit 1
  fi
fi

if [[ "$stopped" -eq 1 ]]; then
  echo "OK: LLM Gateway stopped (port ${RAG_PORT})"
else
  echo "OK: LLM Gateway was not running (port ${RAG_PORT})"
fi
