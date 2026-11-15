#!/usr/bin/env bash
# Restart LLM Gateway (stop → start-bg).
# Usage: ./scripts/llm-gateway-restart.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/llm-gateway-stop.sh" || true
exec "$ROOT/scripts/llm-gateway-start-bg.sh"
