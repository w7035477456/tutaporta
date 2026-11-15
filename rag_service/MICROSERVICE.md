# TutaMall LLM Gateway — A→Z build / start / stop

Stateless FastAPI microservice that owns **all Ollama traffic** for the app:

| Endpoint | Who calls it | Purpose |
|----------|--------------|---------|
| `GET /health` | ops scripts, Node RAG status | Ollama + model readiness |
| `POST /chat` | chat scam, email-scan, profile writer, AI match | Generic chat completion |
| `POST /query-notes` | TutaNotes RAG UI (via Node) | Chunk + retrieve + generate |
| `POST /keep-model` | TutaNotes RAG UI | Pin/unpin model in VRAM |
| `POST /debug-extract` | ops / PDF debugging | PDF text extract only |

Node keeps vault decryption, Postgres writes, and auth. This process only talks to Ollama.

```
Web (xbox3/xbox4)                          GPU box (xbox4, or local Mac)
┌─────────────────────┐                    ┌──────────────────────────┐
│ Express BE          │  HTTP :8765        │ LLM Gateway (uvicorn)    │
│  llmGatewayClient → │ ─────────────────► │   POST /chat             │
│  recordVault RAG  → │                    │   POST /query-notes      │
└─────────────────────┘                    │         │                │
                                           │         ▼                │
                                           │   Ollama :11434          │
                                           │   (qwen / configured)    │
                                           └──────────────────────────┘
```

---

## A. Prerequisites

1. **Python 3.10+** (`python3 --version`)
2. **Ollama** installed and able to pull models
3. Repo at `~/code/main` (Mac) or `/home/lawsen0/code/main` (Ubuntu)
4. BE env file **`~/.ssh/be/.env`** (never commit secrets)

---

## B. Env vars (put in `~/.ssh/be/.env`)

```bash
# Master switch for starting Ollama + gateway (scripts honor this)
AI_MODEL_ENABLE=true

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:30b-a3b
OLLAMA_KEEP_ALIVE=10m
OLLAMA_KEEP_ALIVE_PINNED=-1

# LLM Gateway (same process as legacy RAG)
RAG_HOST=127.0.0.1
RAG_PORT=8765
RAG_ENABLED=true
RAG_SERVICE_URL=http://127.0.0.1:8765
LLM_GATEWAY_URL=http://127.0.0.1:8765
LLM_GATEWAY_ENABLED=true
# Optional but recommended once anything binds beyond localhost:
# LLM_GATEWAY_SECRET=<long random string>
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `LLM_GATEWAY_URL` | `RAG_SERVICE_URL` → `http://127.0.0.1:8765` | Where Node sends `/chat` |
| `LLM_GATEWAY_ENABLED` | `true` | `false` = Node calls Ollama directly (escape hatch) |
| `LLM_GATEWAY_SECRET` | unset | When set, Node must send `X-LLM-Gateway-Key` |
| `RAG_SERVICE_URL` | `http://127.0.0.1:8765` | Same process; used by TutaNotes RAG routes |
| `AI_MODEL_ENABLE` | `true` | `false` → start scripts exit 0 without starting |

**Cross-host (three-server):** run gateway + Ollama on **xbox4**. On xbox3 web `.env`:

```bash
LLM_GATEWAY_URL=http://192.168.202.204:8765
RAG_SERVICE_URL=http://192.168.202.204:8765
LLM_GATEWAY_SECRET=<same secret on xbox4 gateway and every web server>
# On xbox4 gateway host only, also set RAG_HOST=0.0.0.0 so it accepts LAN traffic
# RAG_HOST=0.0.0.0
# OLLAMA_BASE_URL=http://127.0.0.1:11434   # still local to the GPU box
```

---

## C. Build (once, or after `requirements.txt` changes)

```bash
cd ~/code/main
chmod +x scripts/llm-gateway-*.sh scripts/start-rag-service*.sh
./scripts/llm-gateway-build.sh
```

What it does:

1. Creates `rag_service/.venv` if missing
2. `pip install -r rag_service/requirements.txt` (FastAPI, uvicorn, httpx, pymupdf, …)

Rebuild anytime deps change:

```bash
./scripts/llm-gateway-build.sh
```

---

## D. Install / pull the model

```bash
# Mac
brew install ollama
open -a Ollama
# or: ollama serve

# Ubuntu
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama

# Both — pull the tag matching OLLAMA_MODEL in ~/.ssh/be/.env
ollama pull qwen3:30b-a3b
# or lighter: ollama pull qwen2.5:7b
ollama list
```

`llm-gateway-start-bg.sh` will auto-pull the configured model unless `RAG_SKIP_PULL=1`.

---

## E. Start (foreground — debug)

```bash
cd ~/code/main
./scripts/llm-gateway-start.sh
```

- Binds `RAG_HOST:RAG_PORT` (default `127.0.0.1:8765`)
- `--reload` for local edits
- Ctrl+C stops it
- Legacy alias still works: `./scripts/start-rag-service.sh` or Mac alias `startaimodel`

---

## F. Start (background — normal Mac / Ubuntu)

```bash
cd ~/code/main
./scripts/llm-gateway-start-bg.sh
```

What it does:

1. Honors `AI_MODEL_ENABLE`
2. Starts Ollama if `/api/tags` is down
3. Pulls `OLLAMA_MODEL` if missing
4. Stops any prior gateway on the port
5. Builds venv if needed
6. `nohup` → log `rag_service/llm-gateway.log` (also linked as `rag.log`)
7. Waits up to ~120s for `GET /health` with `model_ready`

Legacy: `./scripts/start-rag-service-bg.sh` / alias `startaimodelbg`.

---

## G. Status

```bash
./scripts/llm-gateway-status.sh
```

Or manually:

```bash
curl -sS http://127.0.0.1:8765/health | python3 -m json.tool
```

Expect `"service": "llm-gateway"`, `"status": "ok"`, `"model_ready": true`.

---

## H. Stop

```bash
./scripts/llm-gateway-stop.sh
```

Kills listeners on `RAG_PORT` and any `uvicorn main:app` for this app. Does **not** stop Ollama (shared runtime).

Stop Ollama separately only if you want to free GPU/RAM:

```bash
# Mac app: quit Ollama from menu bar
# Ubuntu:
sudo systemctl stop ollama
```

---

## I. Restart

```bash
./scripts/llm-gateway-restart.sh
# same as: stop → start-bg
```

After changing `~/.ssh/be/.env` keys that the **Python** process reads (`OLLAMA_*`, `LLM_GATEWAY_SECRET`, `RAG_*`), restart the gateway. After changing Node-only keys (`LLM_GATEWAY_URL`, `LLM_GATEWAY_ENABLED`, per-feature `*_OLLAMA_MODEL`), restart BE (`beall` / `pm2 restart tutamallPM2Process`).

---

## J. Smoke-test `/chat`

With gateway up (and secret unset):

```bash
curl -sS http://127.0.0.1:8765/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {"role":"system","content":"Reply with exactly: pong"},
      {"role":"user","content":"ping"}
    ],
    "options": {"temperature": 0}
  }' | python3 -m json.tool
```

With secret set:

```bash
curl -sS http://127.0.0.1:8765/chat \
  -H 'Content-Type: application/json' \
  -H "X-LLM-Gateway-Key: $LLM_GATEWAY_SECRET" \
  -d '{"messages":[{"role":"user","content":"Say hi in 3 words"}]}' \
  | python3 -m json.tool
```

RAG demo (unchanged):

```bash
./scripts/verify-rag-demo.sh
```

---

## K. Wire the Node backend

1. Ensure `~/.ssh/be/.env` has the block from **§B**.
2. Restart BE so it loads env:
   - Mac: restart `beall`
   - Ubuntu: `pm2 restart tutamallPM2Process`
3. Callers that now go through `be/utils/llmGatewayClient.js`:
   - `be/utils/chatScamDetect.js`
   - `be/utils/emailScan.js`
   - `be/routes/user/profileWriter.js`
   - `be/routes/singles/aiMatchFilter.js`
   - TutaNotes RAG (`recordVaultRagRoutes.js`) — same host, sends gateway key on `/query-notes` / `/keep-model`

Escape hatch (dev only):

```bash
LLM_GATEWAY_ENABLED=false   # Node → Ollama directly again
```

---

## L. Logs

| File | What |
|------|------|
| `rag_service/llm-gateway.log` | uvicorn stdout/stderr (bg start) |
| `rag_service/rag.log` | symlink/alias of the same for old habits |
| `rag_service/ollama.log` | only if scripts started `ollama serve` themselves |

```bash
tail -f ~/code/main/rag_service/llm-gateway.log
```

---

## M. Mac day-to-day cheat sheet

```bash
source ~/b
cd ~/code/main

./scripts/llm-gateway-build.sh      # first time / after pip deps
./scripts/llm-gateway-start-bg.sh   # start
./scripts/llm-gateway-status.sh     # check
./scripts/llm-gateway-restart.sh    # bounce after .env / code change
./scripts/llm-gateway-stop.sh       # stop

# legacy aliases still work:
startaimodelbg
startaimodel
```

Then `beall` + `feall` as usual.

---

## N. Ubuntu (All-in-1 xbox2 or GPU xbox4) cheat sheet

```bash
source ~/b
cd ~/code/main
git pull   # if deploying code

./scripts/llm-gateway-build.sh
./scripts/llm-gateway-start-bg.sh
./scripts/llm-gateway-status.sh

# BE already points at localhost when gateway is co-located:
# RAG_SERVICE_URL=http://127.0.0.1:8765
# LLM_GATEWAY_URL=http://127.0.0.1:8765
pm2 restart tutamallPM2Process
```

Optional systemd unit (production-ish) — create `/etc/systemd/system/tutamall-llm-gateway.service` as user `lawsen0`:

```ini
[Unit]
Description=TutaMall LLM Gateway
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=lawsen0
WorkingDirectory=/home/lawsen0/code/main/rag_service
EnvironmentFile=-/home/lawsen0/.ssh/be/.env
ExecStart=/home/lawsen0/code/main/rag_service/.venv/bin/uvicorn main:app --host ${RAG_HOST:-127.0.0.1} --port ${RAG_PORT:-8765}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tutamall-llm-gateway
sudo systemctl status tutamall-llm-gateway
sudo systemctl stop tutamall-llm-gateway
```

If using systemd, prefer that over `llm-gateway-start-bg.sh` so you do not run two copies.

---

## O. API contract (`POST /chat`)

Request:

```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "model": "optional-override",
  "format": "json",
  "think": false,
  "keep_alive": "10m",
  "options": { "temperature": 0, "num_ctx": 16384 },
  "stream": false
}
```

Response:

```json
{
  "content": "model text",
  "model": "qwen3:30b-a3b",
  "model_load_ms": 0
}
```

Auth: if `LLM_GATEWAY_SECRET` is set → header `X-LLM-Gateway-Key: <secret>` required on `/chat`, `/query-notes`, `/keep-model`, `/debug-extract`. `/health` stays open for probes.

---

## P. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `gateway did not answer /health` | `tail -50 rag_service/llm-gateway.log`; check port conflict `lsof -iTCP:8765 -sTCP:LISTEN` |
| `model_ready=false` | `ollama pull "$OLLAMA_MODEL"`; match tag in `.env` |
| Node `LLM gateway unreachable` | Start gateway; check `LLM_GATEWAY_URL`; firewall if cross-host |
| `401 Invalid or missing X-LLM-Gateway-Key` | Same `LLM_GATEWAY_SECRET` in gateway env and every BE `.env`; restart both |
| Still hitting local Ollama from Node | Confirm `LLM_GATEWAY_ENABLED` is not `false`; restart BE |
| PDF / RAG extract fails | Rebuild venv (`pymupdf`), restart gateway |
| First answer very slow | Normal cold load; use Keep model ON in RAG UI |

---

## Q. What this is *not*

- Not a split of TutaNotes / TutaPhoto / TutaDates
- Does not open vaults, read Postgres, or hold sessions
- Does not replace Ollama — it fronts it

---

## R. Script index

| Script | Role |
|--------|------|
| `scripts/llm-gateway-build.sh` | venv + pip |
| `scripts/llm-gateway-start.sh` | foreground |
| `scripts/llm-gateway-start-bg.sh` | background + Ollama ensure |
| `scripts/llm-gateway-stop.sh` | stop gateway |
| `scripts/llm-gateway-status.sh` | health dump |
| `scripts/llm-gateway-restart.sh` | stop + start-bg |
| `scripts/start-rag-service.sh` | alias → start |
| `scripts/start-rag-service-bg.sh` | alias → start-bg |
| `scripts/verify-rag-demo.sh` | RAG smoke demo |
| `be/utils/llmGatewayClient.js` | Node → `/chat` |
