"""
PDF text extraction for RAG.

TurboTax / IRS e-file PDFs are large (75+ pages) and put Form 1040 deep in the
document, after filing instructions and before worksheets. Two rules matter:

1. Scan every page — capping at N pages silently drops the 1040.
2. Send the model the pages that matter, not the whole return (context limit).
"""

from __future__ import annotations

import io
import os
import re

# Hard ceiling only to avoid pathological files; real returns are < 200 pages.
RAG_PDF_MAX_PAGES = int(os.environ.get("RAG_PDF_MAX_PAGES", "400"))

_TAX_PAGE_MARKERS = (
    ("form 1040", 12),
    ("u.s. individual income tax return", 12),
    ("adjusted gross income", 10),
    ("total amount from form(s) w-2", 10),
    ("taxable income", 6),
    ("tax return summary", 6),
    ("standard deduction", 3),
    ("total income", 3),
    ("schedule 1", 2),
    ("schedule b", 1),
)

_AMOUNT_RE = r"\(?\$?\s*(-?[\d]{1,3}(?:,[\d]{3})+(?:\.\d{1,2})?|-?\d{3,}(?:\.\d{1,2})?)\)?"

# label regex, human label, ordering priority
_LINE_LABELS: list[tuple[str, str, int]] = [
    (r"^1a\b", "Form 1040 line 1a — total amount from Form(s) W-2, box 1", 1),
    (r"total amount from form\(s\) w-?2", "Form 1040 line 1a — total amount from Form(s) W-2, box 1", 1),
    (r"^1z\b", "Form 1040 line 1z — total wages", 2),
    (r"^9\b.*total income", "Form 1040 line 9 — total income", 3),
    (r"^11\b", "Form 1040 line 11 — adjusted gross income (AGI)", 4),
    (r"adjusted gross income", "Adjusted gross income (AGI)", 4),
    (r"^12\b.*deduction", "Form 1040 line 12 — standard/itemized deduction", 5),
    (r"^15\b", "Form 1040 line 15 — taxable income", 6),
    (r"taxable income", "Taxable income", 6),
    (r"total tax\b", "Total tax", 7),
    (r"^34\b|amount to be refunded|refund amount", "Refund amount", 8),
]


def _clean(text: str) -> str:
    cleaned = re.sub(r"[ \t\u00a0]+", " ", (text or "").replace("\x00", " "))
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _page_text(page) -> str:
    """Plain text; fall back to block/word order when a page yields nothing."""
    try:
        text = page.get_text("text") or ""
    except Exception:
        text = ""
    if text.strip():
        return text.strip()
    for mode in ("blocks", "words"):
        try:
            items = page.get_text(mode) or []
        except Exception:
            continue
        parts = [str(i[4]).strip() for i in items if len(i) > 4 and str(i[4]).strip()]
        if parts:
            return ("\n" if mode == "blocks" else " ").join(parts).strip()
    return ""


def _widget_text(page) -> str:
    """Fillable-form field values are not part of page text."""
    lines: list[str] = []
    try:
        for w in page.widgets() or []:
            name = str(getattr(w, "field_name", "") or "").strip()
            value = str(getattr(w, "field_value", "") or "").strip()
            if name and value:
                lines.append(f"{name}: {value}")
    except Exception:
        return ""
    return "\n".join(lines)


def extract_pdf_pages(raw: bytes, max_pages: int | None = None) -> list[tuple[int, str]]:
    """[(1-based page number, text)] for every page that yields text."""
    if not raw or not raw.startswith(b"%PDF"):
        return []
    limit = max_pages or RAG_PDF_MAX_PAGES
    try:
        import pymupdf
    except Exception:
        try:
            import fitz as pymupdf  # older PyMuPDF
        except Exception:
            return []
    try:
        doc = pymupdf.open(stream=raw, filetype="pdf")
    except Exception:
        return []
    try:
        pages: list[tuple[int, str]] = []
        for i in range(min(len(doc), limit)):
            try:
                page = doc.load_page(i)
            except Exception:
                continue
            text = _page_text(page)
            fields = _widget_text(page)
            if fields:
                text = f"{text}\n[form fields]\n{fields}".strip()
            if text:
                pages.append((i + 1, text))
        return pages
    finally:
        try:
            doc.close()
        except Exception:
            pass


def _extract_pypdf_pages(raw: bytes, max_pages: int | None = None) -> list[tuple[int, str]]:
    limit = max_pages or RAG_PDF_MAX_PAGES
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw))
    except Exception:
        return []
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages):
        if i >= limit:
            break
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append((i + 1, text.strip()))
    return pages


def score_tax_page(text: str) -> int:
    low = (text or "").lower()
    return sum(weight for marker, weight in _TAX_PAGE_MARKERS if marker in low)


def _amount_from(segment: str) -> str:
    """Last plausible money value in a segment; ignores bare line numbers."""
    best = ""
    for m in re.finditer(_AMOUNT_RE, segment):
        val = m.group(1)
        digits = val.replace(",", "").replace("-", "").split(".")[0]
        if "," in val or "." in val or len(digits) >= 4:
            best = val
    return best


def parse_1040_amounts(pages: list[tuple[int, str]]) -> list[str]:
    """
    Line-oriented parse of key 1040 values.
    Handles labels whose amount lands on the next line (common in PDF text order).
    """
    found: dict[str, tuple[int, str, int]] = {}
    for page_no, text in pages:
        lines = [re.sub(r"\s+", " ", ln).strip() for ln in _clean(text).splitlines()]
        lines = [ln for ln in lines if ln]
        for idx, line in enumerate(lines):
            low = line.lower()
            for pattern, label, priority in _LINE_LABELS:
                if not re.search(pattern, low):
                    continue
                amount = _amount_from(line)
                if not amount:
                    lookahead = " ".join(lines[idx + 1 : idx + 3])
                    amount = _amount_from(lookahead)
                if not amount:
                    continue
                prior = found.get(label)
                if prior is None or priority < prior[0]:
                    found[label] = (priority, amount, page_no)
                break
    if not found:
        return []
    ordered = sorted(found.items(), key=lambda kv: kv[1][0])
    return [f"- {label}: ${amount}  (PDF page {page})" for label, (_, amount, page) in ordered]


def build_pdf_context(
    raw: bytes, *, char_budget: int = 12000
) -> tuple[str, str, dict[str, object]]:
    """
    Returns (context_text, full_text, meta).

    context_text = parsed 1040 amounts + highest-scoring tax pages, trimmed to budget.
    full_text    = all extracted page text (used for keyword chunk retrieval).
    """
    pages = extract_pdf_pages(raw)
    extractor = "pymupdf"
    if not pages:
        pages = _extract_pypdf_pages(raw)
        extractor = "pypdf" if pages else ""
    if not pages:
        return "", "", {"extractor": "", "page_count": 0, "tax_pages": []}

    full_text = "\n\n".join(f"--- PDF page {no} ---\n{text}" for no, text in pages)

    scored = sorted(
        ((score_tax_page(text), no, text) for no, text in pages),
        key=lambda item: (-item[0], item[1]),
    )
    tax_pages = [(no, text) for score, no, text in scored if score >= 6]
    if not tax_pages:
        tax_pages = [(no, text) for _, no, text in scored[:4]]
    tax_pages.sort(key=lambda item: item[0])

    parsed = parse_1040_amounts(tax_pages) or parse_1040_amounts(pages)

    blocks: list[str] = []
    if parsed:
        blocks.append("Key amounts parsed from this PDF:\n" + "\n".join(parsed))

    used = sum(len(b) for b in blocks)
    for no, text in tax_pages:
        if used >= char_budget:
            break
        block = f"--- PDF page {no} ---\n{_clean(text)}"
        remaining = char_budget - used
        if len(block) > remaining:
            block = block[:remaining]
        blocks.append(block)
        used += len(block)

    meta = {
        "extractor": extractor,
        "page_count": len(pages),
        "tax_pages": [no for no, _ in tax_pages][:20],
        "parsed_amounts": parsed,
    }
    return "\n\n".join(blocks).strip(), full_text, meta


def extract_pdf_text(raw: bytes, *, max_pages: int | None = None) -> tuple[str, str]:
    """Backward-compatible helper: (text, extractor)."""
    context, full, meta = build_pdf_context(raw)
    extractor = str(meta.get("extractor") or "")
    if context:
        return context, extractor
    if full:
        return full, extractor
    return "", ""
