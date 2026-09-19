# TutaNotes RAG Service (Python + Ollama + Qwen)

Ephemeral RAG microservice for TutaNotes. The Node backend sends selected note text + PDF attachments; this service chunks them, retrieves relevant passages, and asks a local **Qwen** model through **Ollama** (the local LLM runtime).

> **Llama → Qwen:** You keep **Ollama** installed; you change the **model tag** from `llama3.2` to **`qwen2.5:7b`** (or another Qwen tag). The app reads `OLLAMA_MODEL` from the environment.

## Model choice

| Tag | RAM (approx.) | Use when |
|-----|---------------|----------|
| **`qwen2.5:7b`** (default) | ~8 GB | Mac / Ubuntu with enough RAM |
| **`qwen2.5:3b`** | ~4 GB | Lighter machines — set `OLLAMA_MODEL=qwen2.5:3b` everywhere |

List models: `ollama list`

---

## Mac — install Qwen + demo

### 1. Install Ollama (runtime)

```bash
brew install ollama
```

Or install the menu-bar app from [https://ollama.com/download](https://ollama.com/download) and open it once.

Ensure the API is up:

```bash
ollama serve          # if not using the Mac app
curl -fsS http://127.0.0.1:11434/api/tags
```

### 2. Pull Qwen (replaces Llama)

```bash
ollama pull qwen2.5:7b
# optional smaller: ollama pull qwen2.5:3b
```

Remove old Llama models if you want disk back:

```bash
ollama rm llama3.2    # only if listed in `ollama list`
```

Verify:

```bash
cd ~/code/main
chmod +x scripts/*.sh
./scripts/verify-ollama.sh
```

### 3. Python RAG service

Terminal A:

```bash
cd ~/code/main
./scripts/start-rag-service.sh
```

Terminal B — full demo (health + sample question):

```bash
cd ~/code/main
./scripts/verify-rag-demo.sh
```

### 4. Node backend + UI

Add to **`~/.ssh/be/.env`**:

```bash
RAG_ENABLED=true
RAG_SERVICE_URL=http://127.0.0.1:8765
OLLAMA_MODEL=qwen2.5:7b
```

Restart BE (`beall` on Mac), start FE (`feall`).

**TutaNotes demo:** open `/myNote`, yellow-check two notes (e.g. 2024 / 2025 tax), click **RAG**, ask:  
`Show and compare my 2024 and 2025 tax deductions`

First answer may take **30–120 s** while Qwen loads into GPU/RAM.

---

## Ubuntu — install Qwen + demo

Run on the **same host** as the Node API (or point `RAG_SERVICE_URL` at another machine that runs RAG + Ollama).

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable ollama
sudo systemctl start ollama
systemctl status ollama --no-pager
```

### 2. Pull Qwen

```bash
ollama pull qwen2.5:7b
./scripts/verify-ollama.sh   # from repo root after git pull
```

### 3. RAG Python venv + run

One-shot (foreground, for testing):

```bash
cd ~/code/main
./scripts/start-rag-service.sh
```

**Production:** run uvicorn under **systemd** or **PM2** on `127.0.0.1:8765`, same env as Mac:

```bash
cd ~/code/main/rag_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OLLAMA_MODEL=qwen2.5:7b
export OLLAMA_BASE_URL=http://127.0.0.1:11434
uvicorn main:app --host 127.0.0.1 --port 8765
```

Demo check (with RAG running):

```bash
cd ~/code/main
./scripts/verify-rag-demo.sh
```

### 4. Server env + PM2

In **`~/.ssh/be/.env`** on Ubuntu:

```bash
RAG_ENABLED=true
RAG_SERVICE_URL=http://127.0.0.1:8765
OLLAMA_MODEL=qwen2.5:7b
```

```bash
pm2 restart onlinemallwebsite
```

---

## Architecture

```
React (checkboxes + RAG popup)
    → POST /api/recordVault/rag/query  (Node)
        → POST /query-notes  (Python FastAPI :8765)
            → chunk + keyword retrieval
            → Ollama POST /api/chat  (model: qwen2.5:7b)
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Qwen tag in Ollama |
| `OLLAMA_NUM_CTX` | `16384` | Model context window. Ollama's own default (4k) truncates long PDF excerpts. |
| `RAG_PDF_MAX_PAGES` | `400` | Pages scanned per PDF. TurboTax puts Form 1040 well past page 40. |
| `RAG_PDF_CHAR_BUDGET_PER_NOTE` | `9000` | Chars of PDF text sent per note. |
| `RAG_HOST` / `RAG_PORT` | `127.0.0.1` / `8765` | FastAPI bind |
| `RAG_SERVICE_URL` | (Node) `http://127.0.0.1:8765` | Node → Python |
| `RAG_ENABLED` | `true` | Set `false` to disable route |

Shared default: `scripts/rag-default-model.sh` (sourced by start/verify scripts).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| RAG service offline | `./scripts/start-rag-service.sh` |
| Ollama unreachable | Mac: open Ollama app; Ubuntu: `sudo systemctl start ollama` |
| Model missing | `ollama pull qwen2.5:7b` (match `OLLAMA_MODEL`) |
| Still using Llama | Set `OLLAMA_MODEL=qwen2.5:7b` in `~/.ssh/be/.env`, restart RAG + BE |
| Slow first query | Normal — Qwen load time; use **Keep model ON** in RAG UI |
| Out of memory | Use `OLLAMA_MODEL=qwen2.5:3b` and `ollama pull qwen2.5:3b` |
| RAG ignores PDF / no AGI | Restart RAG after `pip install -r requirements.txt` (**PyMuPDF**). Yellow-check each tax note with a PDF attached. |
| PDF text extract failed | PDF may be scan-only (OCR not enabled yet). Re-save as text PDF or type AGI in note body. |
| Wrong/garbled numbers from a big PDF | Check what RAG actually read (below). |

### Inspect what RAG reads from one PDF

```bash
python3 - <<'PY'
import base64, json, urllib.request
raw = open('/path/to/FINAL_FILING_Federal_efile.pdf','rb').read()
body = {"file_name":"tax.pdf","content_base64":base64.b64encode(raw).decode()}
req = urllib.request.Request("http://127.0.0.1:8765/debug-extract",
    data=json.dumps(body).encode(), headers={'Content-Type':'application/json'})
d = json.loads(urllib.request.urlopen(req, timeout=120).read())
print(d["meta"]); print(d["context_preview"][:1500])
PY
```

`meta.page_count` is how many pages were read, `meta.tax_pages` which pages held Form 1040,
and `meta.parsed_amounts` the line values (1a, 11/AGI, 15) handed to the model.

## API

**POST /query-notes** — see previous section in git history or `main.py` `QueryNotesRequest`.

Response: `{ "answer", "source_notes", "model", "chunks_used" }`
