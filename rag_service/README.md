# TutaNotes RAG Service (Python + Ollama)

Ephemeral RAG microservice for TutaNotes. The Node backend sends selected note text + PDF attachments; this service chunks them, retrieves relevant passages, and asks a local **Ollama** model for an answer.

## A → Z — Mac dev demo

### 1. Install Ollama

**macOS**

```bash
brew install ollama
# Or download from https://ollama.com/download and open the Ollama app
```

Start Ollama (app menu bar, or):

```bash
ollama serve
```

Pull the default model:

```bash
ollama pull llama3.2
```

Verify:

```bash
./scripts/verify-ollama.sh
```

Expected: `OK: Ollama responded.` and `OK: model 'llama3.2' is available.`

### 2. Start the Python RAG service

From repo root:

```bash
./scripts/start-rag-service.sh
```

Leave this terminal open. Service listens on **http://127.0.0.1:8765**.

Health check:

```bash
curl -s http://127.0.0.1:8765/health | python3 -m json.tool
```

### 3. Configure the Node backend

Add to **`~/.ssh/be/.env`** (Mac) or server env (Ubuntu):

```bash
RAG_ENABLED=true
RAG_SERVICE_URL=http://127.0.0.1:8765
OLLAMA_MODEL=llama3.2
```

Restart backend:

```bash
# Mac
beall

# Ubuntu production
pm2 restart onlinemallwebsite
```

### 4. Start frontend

```bash
feall
```

Open **TutaNotes** (`/myNote`), log into Cloud or USB.

### 5. Demo — compare 2024 vs 2025 tax notes

1. Open notebook with sample tax notes (or upload your own **1040 PDFs** as note attachments).
2. Check the **yellow RAG checkbox** on **2024** and **2025** tax notes.
3. Click **RAG** in the toolbar.
4. Ask: `Show and compare my 2024 and 2025 tax deductions`
5. Wait for the answer (first run may take 30–90 seconds while the model loads).

## Architecture

```
React (checkboxes + RAG popup)
    → POST /api/recordVault/rag/query  (Node)
        → loads note HTML + PDF bytes from vault session
        → POST /query-notes  (Python FastAPI)
            → PDF text via pypdf
            → chunk + keyword retrieval
            → Ollama /api/chat
    ← answer JSON
```

## Ubuntu production

1. Install Ollama on the **same host** as the Node API (or set `RAG_SERVICE_URL` to a reachable RAG host).
2. `ollama pull llama3.2`
3. Create venv and run RAG under systemd or PM2, e.g.:

```bash
cd /path/to/main/rag_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
OLLAMA_MODEL=llama3.2 uvicorn main:app --host 127.0.0.1 --port 8765
```

4. Set `RAG_SERVICE_URL=http://127.0.0.1:8765` in `~/.ssh/be/.env` on the server and restart PM2.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API |
| `OLLAMA_MODEL` | `llama3.2` | Chat model |
| `RAG_HOST` / `RAG_PORT` | `127.0.0.1` / `8765` | FastAPI bind |
| `RAG_SERVICE_URL` | (Node) `http://127.0.0.1:8765` | Node → Python |
| `RAG_ENABLED` | `true` | Set `false` to disable route |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| RAG service offline | Run `./scripts/start-rag-service.sh` |
| Ollama unreachable | Run `ollama serve` or open Ollama app |
| Model missing | `ollama pull llama3.2` |
| Empty answer from PDFs | Ensure PDF is text-based (not scanned image-only) |
| PIN-locked note error | Unlock note before including in RAG |
| USB vault | Restart USB bridge app after pulling latest BE (RAG route added to bridge) |

## API

**POST /query-notes**

```json
{
  "prompt": "Compare 2024 and 2025 deductions",
  "notes": [
    {
      "note_id": 1,
      "title": "2024 tax",
      "text_content": "plain text from note body",
      "attachments": [
        {
          "file_name": "f1040.pdf",
          "file_extension": "pdf",
          "content_base64": "..."
        }
      ]
    }
  ]
}
```

Response: `{ "answer", "source_notes", "model", "chunks_used" }`
