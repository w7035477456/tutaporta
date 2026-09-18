"""
TutaNotes RAG microservice — ephemeral in-memory retrieval + Ollama generation.

Env:
  OLLAMA_BASE_URL  default http://127.0.0.1:11434
  OLLAMA_MODEL     default llama3.2
  RAG_HOST         default 127.0.0.1
  RAG_PORT         default 8765
"""

from __future__ import annotations

import base64
import io
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pypdf import PdfReader

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OLLAMA_KEEP_ALIVE_DEFAULT = os.environ.get("OLLAMA_KEEP_ALIVE", "5m")
OLLAMA_KEEP_ALIVE_PINNED = os.environ.get("OLLAMA_KEEP_ALIVE_PINNED", "-1")
CHUNK_SIZE = int(os.environ.get("RAG_CHUNK_SIZE", "900"))
CHUNK_OVERLAP = int(os.environ.get("RAG_CHUNK_OVERLAP", "150"))
TOP_K = int(os.environ.get("RAG_TOP_K", "10"))

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


def _strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _extract_pdf_text(content_base64: str) -> str:
    if not content_base64:
        return ""
    try:
        raw = base64.b64decode(content_base64)
        reader = PdfReader(io.BytesIO(raw))
        parts: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                parts.append(page_text.strip())
        return "\n".join(parts).strip()
    except Exception:
        return ""


def _chunk_text(text: str, note_title: str, note_id: int) -> list[dict[str, Any]]:
    text = (text or "").strip()
    if not text:
        return []
    chunks: list[dict[str, Any]] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_SIZE)
        piece = text[start:end].strip()
        if piece:
            chunks.append(
                {
                    "note_id": note_id,
                    "title": note_title,
                    "text": piece,
                }
            )
        if end >= len(text):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def _tokenize(query: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", query.lower())
    return {w for w in words if len(w) > 2}


def _score_chunk(chunk: dict[str, Any], terms: set[str]) -> float:
    if not terms:
        return 0.0
    hay = chunk["text"].lower()
    score = 0.0
    for term in terms:
        if term in hay:
            score += hay.count(term)
    return score


def _build_documents(notes: list[RagNote]) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for note in notes:
        title = (note.title or f"Note {note.note_id}").strip()
        body = _strip_html(note.text_content or "")
        pdf_parts: list[str] = []
        for att in note.attachments or []:
            ext = (att.file_extension or "").lower()
            if ext == "pdf" or (att.file_name or "").lower().endswith(".pdf"):
                pdf_text = _extract_pdf_text(att.content_base64)
                if pdf_text:
                    label = att.file_name or "attachment.pdf"
                    pdf_parts.append(f"[PDF {label}]\n{pdf_text}")
        combined = body
        if pdf_parts:
            combined = (combined + "\n\n" + "\n\n".join(pdf_parts)).strip()
        documents.extend(_chunk_text(combined, title, note.note_id))
    return documents


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

    documents = _build_documents(body.notes)
    if not documents:
        raise HTTPException(
            status_code=400,
            detail="Selected notes have no readable text. Add note body text or PDF attachments.",
        )

    terms = _tokenize(prompt)
    ranked = sorted(
        ((_score_chunk(doc, terms), doc) for doc in documents),
        key=lambda item: item[0],
        reverse=True,
    )
    top = [doc for score, doc in ranked if score > 0][:TOP_K]
    if not top:
        top = [doc for _, doc in ranked[:TOP_K]]

    context_blocks: list[str] = []
    source_titles: list[str] = []
    seen_titles: set[str] = set()
    for doc in top:
        title = doc["title"]
        if title not in seen_titles:
            seen_titles.add(title)
            source_titles.append(title)
        context_blocks.append(f"### Note: {title}\n{doc['text']}")

    context = "\n\n---\n\n".join(context_blocks)
    system_prompt = (
        "You are a helpful assistant for TutaNotes. Answer ONLY using the provided note excerpts. "
        "If the answer is not in the excerpts, say you could not find it in the selected notes. "
        "When comparing documents (for example tax years), cite specific numbers and line items when present. "
        "Be concise but complete."
    )
    user_prompt = (
        f"User question:\n{prompt}\n\n"
        f"Selected note excerpts:\n{context}\n\n"
        "Answer the user question based on the excerpts above."
    )

    keep_alive = _resolve_keep_alive(body.keep_model_in_memory)
    answer, model_load_ms = await _ollama_chat(system_prompt, user_prompt, keep_alive)
    return QueryNotesResponse(
        answer=answer,
        source_notes=source_titles,
        model=OLLAMA_MODEL,
        chunks_used=len(top),
        model_load_ms=model_load_ms,
    )
