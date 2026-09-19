#!/usr/bin/env bash
# End-to-end check: Ollama + Qwen model + Python RAG service + sample query.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/rag-default-model.sh
source "$ROOT/scripts/rag-default-model.sh"

RAG_URL="${RAG_SERVICE_URL:-http://127.0.0.1:8765}"
RAG_URL="${RAG_URL%/}"

echo "=== 1/4 Ollama + model ${OLLAMA_MODEL} ==="
"$ROOT/scripts/verify-ollama.sh"

echo ""
echo "=== 2/4 RAG health at ${RAG_URL}/health ==="
if ! curl -fsS "${RAG_URL}/health" -o /tmp/rag-health.json; then
  echo "FAIL: RAG service not reachable at ${RAG_URL}"
  echo "Start in another terminal: $ROOT/scripts/start-rag-service.sh"
  exit 1
fi
python3 - <<'PY'
import json, sys
with open("/tmp/rag-health.json") as f:
    h = json.load(f)
print(json.dumps(h, indent=2))
if h.get("status") not in ("ok", "degraded"):
    sys.exit(1)
if h.get("model_ready") is False:
    print("FAIL: configured model not pulled in Ollama.", file=sys.stderr)
    sys.exit(1)
PY

echo ""
echo "=== 3/4 Sample RAG query (may take 30–120s on first load) ==="
curl -fsS "${RAG_URL}/query-notes" \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "In one short sentence, what is 2+2?",
    "notes": [{
      "note_id": 1,
      "title": "demo",
      "text_content": "Demo note: the meeting discussed basic arithmetic. Two plus two equals four.",
      "attachments": []
    }]
  }' -o /tmp/rag-query.json

python3 - <<'PY'
import json
with open("/tmp/rag-query.json") as f:
    r = json.load(f)
ans = (r.get("answer") or "").strip()
if not ans:
    raise SystemExit("FAIL: empty answer from RAG")
print("Answer:", ans[:500])
print("Model:", r.get("model"))
PY

echo ""
echo "=== 4/4 OK — Qwen RAG demo passed ==="
echo "Next: set RAG_ENABLED=true and RAG_SERVICE_URL=${RAG_URL} in ~/.ssh/be/.env, restart BE, use TutaNotes RAG UI."
