#!/usr/bin/env bash
set -euo pipefail

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"

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
model = os.environ.get("OLLAMA_MODEL", "llama3.2")
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
