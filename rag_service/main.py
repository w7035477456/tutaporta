"""
TutaNotes RAG microservice — ephemeral in-memory retrieval + Ollama generation.

Env:
  OLLAMA_BASE_URL  default http://127.0.0.1:11434
  OLLAMA_MODEL     default qwen2.5:7b
  RAG_HOST         default 127.0.0.1
  RAG_PORT         default 8765
"""

from __future__ import annotations

import base64
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pdf_text import build_pdf_context


def _load_rag_keys_from_be_env() -> None:
    """Apply OLLAMA_* from ~/.ssh/be/.env so Python matches Node (loadEnv.js)."""
    env_path = os.path.join(os.path.expanduser("~"), ".ssh", "be", ".env")
    if not os.path.isfile(env_path):
        return
    try:
        with open(env_path, encoding="utf-8") as f:
            for raw in f:
                line = raw.split("#", 1)[0].strip()
                if not line or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key in ("OLLAMA_MODEL", "OLLAMA_BASE_URL") and val:
                    os.environ[key] = val
    except OSError:
        return


_load_rag_keys_from_be_env()

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_KEEP_ALIVE_DEFAULT = os.environ.get("OLLAMA_KEEP_ALIVE", "5m")
OLLAMA_KEEP_ALIVE_PINNED = os.environ.get("OLLAMA_KEEP_ALIVE_PINNED", "-1")
CHUNK_SIZE = int(os.environ.get("RAG_CHUNK_SIZE", "900"))
CHUNK_OVERLAP = int(os.environ.get("RAG_CHUNK_OVERLAP", "150"))
TOP_K = int(os.environ.get("RAG_TOP_K", "10"))
# Ollama defaults to a 4k window and silently drops the rest of the prompt.
OLLAMA_NUM_CTX = int(os.environ.get("OLLAMA_NUM_CTX", "16384"))
# Roughly 3.5 chars/token, leaving room for the answer.
RAG_CONTEXT_CHAR_BUDGET = int(
    os.environ.get("RAG_CONTEXT_CHAR_BUDGET", str(max(4000, OLLAMA_NUM_CTX * 3)))
)
RAG_PDF_CHAR_BUDGET_PER_NOTE = int(os.environ.get("RAG_PDF_CHAR_BUDGET_PER_NOTE", "9000"))
BODY_CHUNK_SCORE_BOOST = float(os.environ.get("RAG_BODY_CHUNK_SCORE_BOOST", "2"))
PDF_CHUNK_SCORE_BOOST = float(os.environ.get("RAG_PDF_CHUNK_SCORE_BOOST", "3"))
JUNK_TEXT_MARKERS = (
    "Service Update | OnlineMall",
    "We're Fine-Tuning Things",
    "OnlineMall.Website",
    "support@onlinemall.website",
)

app = FastAPI(title="TutaNotes RAG Service", version="1.0.0")


class RagAttachment(BaseModel):
    file_name: str = ""
    file_extension: str = ""
    content_base64: str = ""


class RagNote(BaseModel):
    note_id: int
    title: str = ""
    text_content: str = ""
    attachments: list[RagAttachment] = Field(default_factory=list)


class QueryNotesRequest(BaseModel):
    prompt: str
    notes: list[RagNote] = Field(default_factory=list)
    keep_model_in_memory: bool | None = None


class KeepModelRequest(BaseModel):
    enabled: bool = False


class QueryNotesResponse(BaseModel):
    answer: str
    source_notes: list[str]
    model: str
    chunks_used: int
    model_load_ms: int = 0
    extraction_warnings: list[str] = Field(default_factory=list)
    pdf_notes_with_text: int = 0
    pdf_attachments_in_request: int = 0
    pdf_debug: list[dict[str, Any]] = Field(default_factory=list)


class DebugExtractRequest(BaseModel):
    file_name: str = ""
    content_base64: str = ""


def _strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _is_junk_text(text: str) -> bool:
    hay = (text or "").strip()
    if not hay:
        return True
    return any(marker.lower() in hay.lower() for marker in JUNK_TEXT_MARKERS)


def _decode_attachment_bytes(content_base64: str) -> bytes:
    if not content_base64:
        return b""
    try:
        return base64.b64decode(content_base64)
    except Exception:
        return b""


def _html_fallback_text(raw: bytes) -> str:
    """Some uploads are HTML/text saved with a .pdf extension."""
    try:
        decoded = raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""
    lowered = decoded.lower()
    if "<html" in lowered or "<!doctype" in lowered or "<title" in lowered:
        return _strip_html(decoded)
    return ""


def _chunk_text(
    text: str,
    note_title: str,
    note_id: int,
    *,
    source: str = "body",
) -> list[dict[str, Any]]:
    text = (text or "").strip()
    if not text or _is_junk_text(text):
        return []
    chunks: list[dict[str, Any]] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_SIZE)
        piece = text[start:end].strip()
        if piece and not _is_junk_text(piece):
            chunks.append(
                {
                    "note_id": note_id,
                    "title": note_title,
                    "text": piece,
                    "source": source,
                }
            )
        if end >= len(text):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def _tokenize(query: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", query.lower())
    terms = {w for w in words if len(w) > 2 or w in ("1a", "1z", "11")}
    if "agi" in terms:
        terms.update(["adjusted", "gross", "income"])
    if "line" in terms or "1040" in terms:
        terms.update(["1a", "1040", "form", "w-2", "w2", "amount", "income"])
    return terms


def _score_chunk(chunk: dict[str, Any], terms: set[str]) -> float:
    if not terms:
        return 0.0
    hay = chunk["text"].lower()
    score = 0.0
    for term in terms:
        if term in hay:
            score += hay.count(term)
    if score <= 0:
        return 0.0
    source = chunk.get("source")
    if source == "body":
        score *= BODY_CHUNK_SCORE_BOOST
    elif source in ("pdf", "pdf_lead"):
        score *= PDF_CHUNK_SCORE_BOOST
    return score


def _is_tax_financial_query(prompt: str) -> bool:
    p = (prompt or "").lower()
    needles = (
        "agi",
        "adjusted gross",
        "taxable income",
        "tax return",
        "federal",
        "deduction",
        "refund",
        "each year",
        "each tax",
        "tax year",
        "1040",
        "line 1",
        "line 1a",
        "1a",
        "w-2",
        "w2",
    )
    return any(n in p for n in needles)


def _count_pdf_attachments(notes: list[RagNote]) -> int:
    total = 0
    for note in notes:
        for att in note.attachments or []:
            ext = (att.file_extension or "").lower().lstrip(".")
            name = (att.file_name or "").lower()
            if ext in ("pdf", "application/pdf") or name.endswith(".pdf"):
                total += 1
    return total


def _select_context_chunks(
    documents: list[dict[str, Any]], prompt: str, terms: set[str], top_k: int
) -> list[dict[str, Any]]:
    pdf_leads = [d for d in documents if d.get("source") == "pdf_lead"]
    if pdf_leads and _is_tax_financial_query(prompt):
        pdf_leads.sort(key=lambda d: (str(d.get("title") or ""), int(d.get("note_id") or 0)))
        return pdf_leads

    ranked = sorted(
        ((_score_chunk(doc, terms), doc) for doc in documents),
        key=lambda item: item[0],
        reverse=True,
    )
    top = [doc for score, doc in ranked if score > 0][:top_k]
    if not top:
        top = [doc for _, doc in ranked[:top_k]]
    top = _ensure_pdf_chunks_in_context(top, documents, terms, top_k)

    if pdf_leads:
        merged: list[dict[str, Any]] = []
        seen: set[int] = set()
        for doc in pdf_leads + top:
            key = id(doc)
            if key in seen:
                continue
            seen.add(key)
            merged.append(doc)
        return merged[: max(top_k + len(pdf_leads), top_k)]
    return top


def _ensure_pdf_chunks_in_context(
    top: list[dict[str, Any]], documents: list[dict[str, Any]], terms: set[str], top_k: int
) -> list[dict[str, Any]]:
    """Always include the best PDF chunk per note so tax PDFs are not dropped by body-only ranking."""
    pdf_docs = [d for d in documents if d.get("source") == "pdf"]
    if not pdf_docs:
        return top[:top_k]
    by_note: dict[int, list[dict[str, Any]]] = {}
    for doc in pdf_docs:
        by_note.setdefault(int(doc["note_id"]), []).append(doc)
    merged: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for doc in top:
        merged.append(doc)
        seen_ids.add(id(doc))
    for note_id, chunks in by_note.items():
        if any(d.get("note_id") == note_id and d.get("source") == "pdf" for d in merged):
            continue
        best = max(chunks, key=lambda c: _score_chunk(c, terms))
        if id(best) not in seen_ids:
            merged.insert(0, best)
            seen_ids.add(id(best))
    return merged[: max(top_k, min(top_k + len(by_note), top_k + 5))]


def _build_documents(
    notes: list[RagNote],
) -> tuple[list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    documents: list[dict[str, Any]] = []
    warnings: list[str] = []
    debug: list[dict[str, Any]] = []
    for note in notes:
        title = (note.title or f"Note {note.note_id}").strip()
        body = _strip_html(note.text_content or "")
        documents.extend(_chunk_text(body, title, note.note_id, source="body"))
        for att in note.attachments or []:
            ext = (att.file_extension or "").lower().lstrip(".")
            name = (att.file_name or "").lower()
            mime_pdf = ext in ("pdf", "application/pdf") or name.endswith(".pdf")
            if not mime_pdf:
                continue
            raw = _decode_attachment_bytes(att.content_base64)
            label = att.file_name or "attachment.pdf"
            if not raw:
                warnings.append(f"{title}: attachment {label} has no bytes (re-open note or re-sync vault).")
                continue
            if not raw.startswith(b"%PDF"):
                warnings.append(f"{title}: {label} is not a readable PDF file.")
                continue
            context_text, full_text, meta = build_pdf_context(
                raw, char_budget=RAG_PDF_CHAR_BUDGET_PER_NOTE
            )
            if not context_text:
                fallback = _html_fallback_text(raw)
                if fallback:
                    context_text, full_text = fallback, fallback
                    meta = {"extractor": "html", "page_count": 0, "tax_pages": []}
            if not context_text or _is_junk_text(context_text):
                warnings.append(
                    f"{title}: could not extract text from {label} "
                    "(install pymupdf in rag_service/.venv, then restart the RAG service)."
                )
                debug.append({"note": title, "file": label, "pages": 0, "extracted": False})
                continue

            extractor = str(meta.get("extractor") or "pymupdf")
            debug.append(
                {
                    "note": title,
                    "file": label,
                    "pages": meta.get("page_count", 0),
                    "tax_pages": meta.get("tax_pages", []),
                    "parsed_amounts": meta.get("parsed_amounts", []),
                    "extracted": True,
                    "extractor": extractor,
                }
            )
            documents.append(
                {
                    "note_id": note.note_id,
                    "title": title,
                    "text": f"[PDF «{label}» attached to note «{title}» — {extractor}]\n{context_text}",
                    "source": "pdf_lead",
                }
            )
            documents.extend(
                _chunk_text(
                    f"[PDF full text {label}]\n{full_text}", title, note.note_id, source="pdf"
                )
            )
    return documents, warnings, debug


def _resolve_keep_alive(keep_model_in_memory: bool | None) -> str:
    if keep_model_in_memory is True:
        return OLLAMA_KEEP_ALIVE_PINNED
    return OLLAMA_KEEP_ALIVE_DEFAULT


def _load_duration_ms(ollama_response: dict[str, Any]) -> int:
    """Ollama reports load_duration in nanoseconds; 0 when model already in RAM."""
    raw = ollama_response.get("load_duration")
    if raw is None:
        return 0
    try:
        ns = int(raw)
        return max(0, round(ns / 1_000_000))
    except (TypeError, ValueError):
        return 0


def _ollama_keep_alive_json_value(keep_alive: str) -> str | int:
    """
    Ollama accepts duration strings (5m, 30m) or integer seconds.
    Indefinite load must be JSON number -1 — string "-1" errors on newer Ollama.
    """
    raw = str(keep_alive or "").strip().lower()
    if raw in ("-1", "inf", "infinite", "forever"):
        return -1
    if raw.lstrip("-").isdigit():
        return int(raw)
    return keep_alive


async def _ollama_chat(system_prompt: str, user_prompt: str, keep_alive: str) -> tuple[str, int]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "keep_alive": _ollama_keep_alive_json_value(keep_alive),
        # Without num_ctx Ollama uses a small default window and drops most of the excerpts.
        "options": {"num_ctx": OLLAMA_NUM_CTX, "temperature": 0.1},
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        if resp.status_code >= 400:
            detail = resp.text.strip() or resp.reason_phrase
            raise HTTPException(
                status_code=502,
                detail=f"Ollama chat failed ({resp.status_code}): {detail}",
            )
        data = resp.json()
        message = data.get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            raise HTTPException(status_code=502, detail="Ollama returned an empty answer.")
        return content, _load_duration_ms(data)


async def _ollama_warm_keep_alive(keep_alive: str) -> None:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": "Reply with exactly: OK",
        "stream": False,
        "keep_alive": _ollama_keep_alive_json_value(keep_alive),
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        if resp.status_code >= 400:
            detail = resp.text.strip() or resp.reason_phrase
            raise HTTPException(
                status_code=502,
                detail=f"Ollama warm-up failed ({resp.status_code}): {detail}",
            )


async def _check_ollama() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        resp.raise_for_status()
        data = resp.json()
        models = [m.get("name") for m in data.get("models") or [] if m.get("name")]
        return {"ok": True, "models": models, "configured_model": OLLAMA_MODEL}


@app.get("/health")
async def health() -> dict[str, Any]:
    try:
        ollama = await _check_ollama()
        model_ready = any(
            (OLLAMA_MODEL == name) or name.startswith(f"{OLLAMA_MODEL}:")
            for name in ollama.get("models") or []
        )
        return {
            "status": "ok" if model_ready else "degraded",
            "ollama": ollama,
            "model_ready": model_ready,
        }
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
            "ollama_base_url": OLLAMA_BASE_URL,
            "configured_model": OLLAMA_MODEL,
        }


@app.post("/keep-model")
async def keep_model(body: KeepModelRequest) -> dict[str, Any]:
    keep_alive = _resolve_keep_alive(body.enabled)
    if body.enabled:
        await _ollama_warm_keep_alive(keep_alive)
    return {
        "ok": True,
        "enabled": body.enabled,
        "keep_alive": keep_alive,
        "model": OLLAMA_MODEL,
    }


@app.post("/query-notes", response_model=QueryNotesResponse)
async def query_notes(body: QueryNotesRequest) -> QueryNotesResponse:
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    if not body.notes:
        raise HTTPException(status_code=400, detail="At least one note is required")

    pdf_attachments_in_request = _count_pdf_attachments(body.notes)
    documents, pdf_warnings, pdf_debug = _build_documents(body.notes)
    pdf_notes_with_text = len({d["note_id"] for d in documents if d.get("source") == "pdf_lead"})

    if pdf_attachments_in_request > 0 and pdf_notes_with_text == 0:
        detail = (
            "Attached PDFs had no extractable text. Run: cd rag_service && source .venv/bin/activate "
            "&& pip install -r requirements.txt (needs pymupdf), then restart ./scripts/start-rag-service.sh."
        )
        if pdf_warnings:
            detail += " Details: " + "; ".join(pdf_warnings[:6])
        raise HTTPException(status_code=400, detail=detail)

    if not documents:
        detail = "Selected notes have no readable text. Add note body text or PDF attachments."
        if pdf_warnings:
            detail += " PDF issues: " + "; ".join(pdf_warnings[:5])
        raise HTTPException(status_code=400, detail=detail)

    terms = _tokenize(prompt)
    top = _select_context_chunks(documents, prompt, terms, TOP_K)

    context_blocks: list[str] = []
    source_titles: list[str] = []
    seen_titles: set[str] = set()
    used_chars = 0
    per_doc_budget = max(1500, RAG_CONTEXT_CHAR_BUDGET // max(1, len(top)))
    for doc in top:
        if used_chars >= RAG_CONTEXT_CHAR_BUDGET:
            break
        title = doc["title"]
        text = doc["text"]
        if len(text) > per_doc_budget:
            text = text[:per_doc_budget]
        if title not in seen_titles:
            seen_titles.add(title)
            source_titles.append(title)
        block = f"### Note: {title}\n{text}"
        context_blocks.append(block)
        used_chars += len(block)

    context = "\n\n---\n\n".join(context_blocks)
    system_prompt = (
        "You are a helpful assistant for TutaNotes. Answer ONLY using the provided note excerpts. "
        "Each ### Note section is a separate selected note (often a tax year). "
        "Excerpts are text from PDF attachments (often IRS Form 1040 inside a TurboTax PDF). "
        "Prefer lines labeled 1a, 11 (AGI), taxable income, and sections titled 'Structured Form 1040 amounts parsed'. "
        "Do NOT answer from refund/balance-due summary alone when the user asks for a specific 1040 line. "
        "When the user asks for each year, list every note title/year with the requested line amount if present. "
        "If a value appears in the excerpts, you MUST report it — do not say it is missing. "
        "Be concise but complete."
    )
    user_prompt = (
        f"User question:\n{prompt}\n\n"
        f"Selected note excerpts:\n{context}\n\n"
        "Answer using the excerpts. For multi-year questions, use one bullet per note title/year."
    )

    keep_alive = _resolve_keep_alive(body.keep_model_in_memory)
    answer, model_load_ms = await _ollama_chat(system_prompt, user_prompt, keep_alive)
    return QueryNotesResponse(
        answer=answer,
        source_notes=source_titles,
        model=OLLAMA_MODEL,
        chunks_used=len(top),
        model_load_ms=model_load_ms,
        extraction_warnings=pdf_warnings[:10],
        pdf_notes_with_text=pdf_notes_with_text,
        pdf_attachments_in_request=pdf_attachments_in_request,
        pdf_debug=pdf_debug,
    )


@app.post("/debug-extract")
async def debug_extract(body: DebugExtractRequest) -> dict[str, Any]:
    """Inspect what RAG actually reads from one PDF (no model call)."""
    raw = _decode_attachment_bytes(body.content_base64)
    if not raw:
        raise HTTPException(status_code=400, detail="content_base64 is required")
    context_text, full_text, meta = build_pdf_context(
        raw, char_budget=RAG_PDF_CHAR_BUDGET_PER_NOTE
    )
    return {
        "file_name": body.file_name,
        "bytes": len(raw),
        "is_pdf": raw.startswith(b"%PDF"),
        "meta": meta,
        "full_text_chars": len(full_text),
        "context_preview": context_text[:4000],
    }
