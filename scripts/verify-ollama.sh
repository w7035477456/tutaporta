#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/load-be-rag-env.sh
source "$ROOT/scripts/load-be-rag-env.sh"
load_be_rag_env
# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

echo "Checking Ollama at ${OLLAMA_BASE_URL} ..."
if ! curl -fsS "${OLLAMA_BASE_URL}/api/tags" >/tmp/ollama-tags.json; then
  echo "FAIL: Ollama is not reachable."
  echo "Install: https://ollama.com/download"
  echo "Then run: ollama serve   (or open the Ollama app on Mac)"
  exit 1
fi

echo "OK: Ollama responded."
python3 - <<'PY'
import json, os, sys
model = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
with open("/tmp/ollama-tags.json") as f:
    data = json.load(f)
names = [m.get("name") for m in data.get("models") or [] if m.get("name")]
print("Installed models:", ", ".join(names) if names else "(none)")
ready = any(model == n or n.startswith(model + ":") for n in names)
if not ready:
    print(f"WARN: model '{model}' not found. Run: ollama pull {model}")
    sys.exit(2)
print(f"OK: model '{model}' is available.")
PY

echo "Quick generate test ..."
curl -fsS "${OLLAMA_BASE_URL}/api/generate" \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"${OLLAMA_MODEL}\",\"prompt\":\"Reply with exactly: Ollama OK\",\"stream\":false}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('response','').strip() or '(empty)')"

echo "All Ollama checks passed."
