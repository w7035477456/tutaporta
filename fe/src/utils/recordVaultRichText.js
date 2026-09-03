const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'hr',
  'h1',
  'h2',
  'h3',
  'table',
  'tbody',
  'thead',
  'tr',
  'td',
  'th',
  'img',
  'mark',
  'div'
]);

const ATTACHMENT_DIV_ATTRS = new Set([
  'data-rv-attachment',
  'data-attachment-id',
  'data-file-name',
  'data-file-extension',
  'data-file-size'
]);

const ALLOWED_SPAN_STYLE_PROPS = new Set([
  'color',
  'font-weight',
  'font-size',
  'background-color',
  'font-family',
  'line-height'
]);
const ALLOWED_BLOCK_STYLE_PROPS = new Set(['text-align']);

const CLIPBOARD_HEADING_PT = {
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16
};

function pxToPt(px) {
  const n = Number(px);
  if (!Number.isFinite(n)) return null;
  return Math.round((n * 72) / 96);
}

function parseStyleDeclarations(styleText) {
  const out = {};
  for (const part of String(styleText || '').split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function normalizeClipboardFontSize(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const ptMatch = raw.match(/^([\d.]+)\s*pt$/i);
  if (ptMatch) return `${Number(ptMatch[1])}pt`;
  const pxMatch = raw.match(/^([\d.]+)\s*px$/i);
  if (pxMatch) {
    const pt = pxToPt(pxMatch[1]);
    return pt ? `${pt}pt` : null;
  }
  return null;
}

function inheritedStyleText(inherited) {
  const parts = [];
  if (inherited.color) parts.push(`color: ${inherited.color}`);
  if (inherited.fontWeight) parts.push(`font-weight: ${inherited.fontWeight}`);
  if (inherited.fontSize) parts.push(`font-size: ${inherited.fontSize}`);
  if (inherited.backgroundColor) parts.push(`background-color: ${inherited.backgroundColor}`);
  return parts.join('; ');
}

function hasInheritedStyle(inherited) {
  return Boolean(inherited.color || inherited.fontWeight || inherited.fontSize || inherited.backgroundColor);
}

function inheritFromElement(tag, element, parentInherited) {
  const next = { ...parentInherited };
  if (tag === 'b' || tag === 'strong') next.fontWeight = '700';
  if (CLIPBOARD_HEADING_PT[tag]) next.fontSize = `${CLIPBOARD_HEADING_PT[tag]}pt`;

  const inline = parseStyleDeclarations(element.getAttribute('style'));
  if (inline.color) next.color = inline.color;
  if (inline['font-weight']) next.fontWeight = inline['font-weight'];
  const fontSize = normalizeClipboardFontSize(inline['font-size']);
  if (fontSize) next.fontSize = fontSize;
  if (inline['background-color']) next.backgroundColor = inline['background-color'];

  return next;
}

function wrapNodesInSpan(doc, nodes, inherited) {
  if (!nodes.length) return null;
  if (!hasInheritedStyle(inherited)) {
    if (nodes.length === 1) return nodes[0];
    const frag = doc.createDocumentFragment();
    for (const node of nodes) frag.appendChild(node);
    return frag;
  }

  const span = doc.createElement('span');
  const style = inheritedStyleText(inherited);
  if (style) span.setAttribute('style', style);
  for (const node of nodes) span.appendChild(node);
  return span;
}

function appendNodes(target, nodes) {
  for (const node of nodes) {
    if (!node) continue;
    target.appendChild(node);
  }
}

function appendBlockBreak(doc, target) {
  const last = target.lastChild;
  if (last && last.nodeType === Node.ELEMENT_NODE && last.tagName === 'BR') return;
  target.appendChild(doc.createElement('br'));
}

function flattenClipboardNode(node, doc, inherited, out) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return;
    if (hasInheritedStyle(inherited)) {
      const span = doc.createElement('span');
      span.setAttribute('style', inheritedStyleText(inherited));
      span.textContent = text;
      out.appendChild(span);
    } else {
      out.appendChild(doc.createTextNode(text));
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();
  if (tag === 'br') {
    out.appendChild(doc.createElement('br'));
    return;
  }

  const nextInherited = inheritFromElement(tag, node, inherited);

  if (tag === 'table') {
    for (const child of Array.from(node.childNodes)) {
      flattenClipboardNode(child, doc, nextInherited, out);
    }
    appendBlockBreak(doc, out);
    return;
  }

  if (tag === 'tr') {
    let firstCell = true;
    for (const child of Array.from(node.childNodes)) {
      const childTag = child.nodeType === Node.ELEMENT_NODE ? child.tagName.toLowerCase() : '';
      if (childTag !== 'td' && childTag !== 'th') continue;
      if (!firstCell) {
        const tab = doc.createElement('span');
        tab.textContent = '\t';
        out.appendChild(tab);
      }
      firstCell = false;
      const cellInherited =
        childTag === 'th' ? { ...nextInherited, fontWeight: nextInherited.fontWeight || '700' } : nextInherited;
      flattenClipboardNode(child, doc, cellInherited, out);
    }
    appendBlockBreak(doc, out);
    return;
  }

  if (tag === 'li') {
    const bullet = doc.createElement('span');
    const style = inheritedStyleText(nextInherited);
    if (style) bullet.setAttribute('style', style);
    bullet.textContent = '• ';
    out.appendChild(bullet);
    for (const child of Array.from(node.childNodes)) {
      flattenClipboardNode(child, doc, nextInherited, out);
    }
    appendBlockBreak(doc, out);
    return;
  }

  const isBlock =
    ['p', 'div', 'section', 'article', 'header', 'footer', 'blockquote', 'ul', 'ol'].includes(tag) ||
    Boolean(CLIPBOARD_HEADING_PT[tag]);

  if (isBlock) {
    const blockOut = doc.createDocumentFragment();
    for (const child of Array.from(node.childNodes)) {
      flattenClipboardNode(child, doc, nextInherited, blockOut);
    }
    const wrapped = wrapNodesInSpan(doc, Array.from(blockOut.childNodes), nextInherited);
    if (wrapped) {
      if (wrapped.nodeType === Node.DOCUMENT_FRAGMENT_NODE) appendNodes(out, Array.from(wrapped.childNodes));
      else out.appendChild(wrapped);
    }
    appendBlockBreak(doc, out);
    return;
  }

  const inlineOut = doc.createDocumentFragment();
  for (const child of Array.from(node.childNodes)) {
    flattenClipboardNode(child, doc, nextInherited, inlineOut);
  }
  const wrapped = wrapNodesInSpan(doc, Array.from(inlineOut.childNodes), nextInherited);
  if (!wrapped) return;
  if (wrapped.nodeType === Node.DOCUMENT_FRAGMENT_NODE) appendNodes(out, Array.from(wrapped.childNodes));
  else out.appendChild(wrapped);
}

function readAllowedStyle(styleValue, allowedProps) {
  if (!styleValue) return '';
  const parts = String(styleValue)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const kept = [];
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (allowedProps.has(key) && value) {
      kept.push(`${key}: ${value}`);
    }
  }
  return kept.join('; ');
}

function sanitizeImgSrc(src) {
  const raw = String(src ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('javascript:')) return '';
  if (lower.startsWith('data:image/')) return raw;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
  return '';
}

function sanitizeHref(href) {
  const raw = String(href ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  return raw;
}

/** Allow semantic note HTML; strip scripts and unsafe attrs. */
export function sanitizeRecordVaultHtml(html) {
  const raw = String(html ?? '');
  if (!raw.includes('<') || typeof document === 'undefined') return raw;

  const template = document.createElement('template');
  template.innerHTML = raw;

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }

      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        walk(child);
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        child.remove();
        continue;
      }

      if (tag === 'br') continue;

      if (tag === 'div') {
        // TipTap vault file attachment atoms — keep metadata attrs for reload.
        if (child.hasAttribute('data-rv-attachment')) {
          for (const attr of Array.from(child.attributes)) {
            if (!ATTACHMENT_DIV_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
          }
          child.setAttribute('data-rv-attachment', '');
          continue;
        }
        walk(child);
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        child.remove();
        continue;
      }

      if (tag === 'span') {
        const allowed = readAllowedStyle(child.getAttribute('style'), ALLOWED_SPAN_STYLE_PROPS);
        if (allowed) child.setAttribute('style', allowed);
        else child.removeAttribute('style');
        walk(child);
        continue;
      }

      if (tag === 'p') {
        const allowed = readAllowedStyle(child.getAttribute('style'), ALLOWED_BLOCK_STYLE_PROPS);
        if (allowed) child.setAttribute('style', allowed);
        else child.removeAttribute('style');
        walk(child);
        continue;
      }

      if (tag === 'a') {
        const href = sanitizeHref(child.getAttribute('href'));
        child.removeAttribute('onclick');
        child.removeAttribute('onmousedown');
        if (href) child.setAttribute('href', href);
        else child.removeAttribute('href');
        child.setAttribute('rel', 'noopener noreferrer');
        child.setAttribute('target', '_blank');
        walk(child);
        continue;
      }

      if (tag === 'ul' || tag === 'ol' || tag === 'li') {
        const dataType = child.getAttribute('data-type');
        if (dataType) child.setAttribute('data-type', dataType);
        if (tag === 'li') {
          const checked = child.getAttribute('data-checked');
          if (checked === 'true' || checked === 'false') {
            child.setAttribute('data-checked', checked);
          } else {
            child.removeAttribute('data-checked');
          }
        }
        walk(child);
        continue;
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'hr' || tag === 'code' || tag === 'pre') {
        walk(child);
        continue;
      }

      if (tag === 'mark') {
        const dataColor = child.getAttribute('data-color');
        if (dataColor) child.setAttribute('data-color', dataColor);
        const style = readAllowedStyle(child.getAttribute('style'), new Set(['background-color', 'color']));
        if (style) child.setAttribute('style', style);
        else child.removeAttribute('style');
        walk(child);
        continue;
      }

      if (tag === 'img') {
        const src = sanitizeImgSrc(child.getAttribute('src'));
        child.removeAttribute('onclick');
        child.removeAttribute('onmousedown');
        if (src) child.setAttribute('src', src);
        else {
          child.remove();
          continue;
        }
        const alt = String(child.getAttribute('alt') ?? '').slice(0, 500);
        if (alt) child.setAttribute('alt', alt);
        else child.removeAttribute('alt');
        continue;
      }

      if (tag === 'table' || tag === 'tbody' || tag === 'thead' || tag === 'tr') {
        walk(child);
        continue;
      }

      if (tag === 'td' || tag === 'th') {
        const colspan = child.getAttribute('colspan');
        const rowspan = child.getAttribute('rowspan');
        if (colspan && Number(colspan) > 1) child.setAttribute('colspan', colspan);
        else child.removeAttribute('colspan');
        if (rowspan && Number(rowspan) > 1) child.setAttribute('rowspan', rowspan);
        else child.removeAttribute('rowspan');
        walk(child);
        continue;
      }

      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

/** Fallback flatten for Gemini / table-heavy clipboard HTML. */
export function normalizeClipboardHtmlForRecordVault(html) {
  const raw = String(html ?? '').trim();
  if (!raw || typeof document === 'undefined') return '';

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const out = document.createElement('div');
  for (const child of Array.from(doc.body.childNodes)) {
    flattenClipboardNode(child, doc, {}, out);
  }

  while (out.lastChild && out.lastChild.nodeType === Node.ELEMENT_NODE && out.lastChild.tagName === 'BR') {
    out.removeChild(out.lastChild);
  }

  return sanitizeRecordVaultHtml(out.innerHTML);
}

export function stripRecordVaultHtml(html) {
  const raw = String(html ?? '');
  if (!raw.includes('<')) return raw;
  if (typeof document === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ');
  }
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return doc.body.textContent || '';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function plainTextToEditorHtml(text) {
  const raw = String(text ?? '');
  if (!raw) return '';
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

export const RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN =
  'Please Edit title above, add text, docs, and image here. File type accept are: jpg, jpeg, png, gif, webp, svg, avif, tif, bmp, heic, raw, psd, ai, eps, ico, pdf, doc, docx, xls, xlsx, ppt, pptx, json, csv, javascript, zip, mp3, mp4, txt, yaml, css, xml, tar, gz, xz';

function normalizeRecordVaultPlainBodyText(value) {
  return stripRecordVaultHtml(value).replace(/\s+/g, ' ').trim();
}

export function isRecordVaultLegacyDefaultBodyText(value) {
  return (
    normalizeRecordVaultPlainBodyText(value) ===
    normalizeRecordVaultPlainBodyText(RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN)
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Drop the old default intro paragraph when it is saved alone or before real note content. */
export function removeRecordVaultLegacyDefaultBodyIntro(value) {
  const raw = String(value ?? '');
  if (!raw || isRecordVaultLegacyDefaultBodyText(raw)) return '';

  const legacyPlain = normalizeRecordVaultPlainBodyText(RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN);
  const plain = normalizeRecordVaultPlainBodyText(raw);
  if (!plain.startsWith(legacyPlain)) return raw;

  const restPlain = plain.slice(legacyPlain.length).trim();
  if (!restPlain) return '';

  const legacyHtmlPattern = new RegExp(
    `^\\s*<p[^>]*>\\s*${escapeRegExp(RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN)}\\s*</p>\\s*`,
    'i'
  );
  const withoutHtmlParagraph = raw.replace(legacyHtmlPattern, '').trimStart();
  if (withoutHtmlParagraph !== raw) return withoutHtmlParagraph;

  const legacyPlainPattern = new RegExp(`^\\s*${escapeRegExp(RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN)}\\s*`, 'i');
  const withoutPlainPrefix = raw.replace(legacyPlainPattern, '').trimStart();
  if (withoutPlainPrefix !== raw) return withoutPlainPrefix;

  return plainTextToEditorHtml(restPlain);
}

export function clearRecordVaultLegacyDefaultBodyText(value) {
  return removeRecordVaultLegacyDefaultBodyIntro(value);
}

export function recordVaultBodyHasLegacyIntro(value) {
  const raw = String(value ?? '');
  if (!raw) return false;
  if (isRecordVaultLegacyDefaultBodyText(raw)) return true;
  const legacyPlain = normalizeRecordVaultPlainBodyText(RECORD_VAULT_LEGACY_DEFAULT_BODY_PLAIN);
  return normalizeRecordVaultPlainBodyText(raw).startsWith(legacyPlain);
}

export function recordVaultRichTextHasContent(value) {
  return Boolean(stripRecordVaultHtml(value).trim());
}

function normalizeTitleMatchPlain(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Drop trailing uniqueness suffixes like " [2]" or " [#]" used in note titles. */
function stripTrailingTitleBracketSuffix(text) {
  return String(text ?? '')
    .replace(/\s*\[(?:\d+|#)\]\s*$/i, '')
    .trim();
}

/** Title/body comparison key: ignore case, whitespace, and trailing [n]/[#]. */
function normalizeTitleForBodyMatch(text) {
  return normalizeTitleMatchPlain(stripTrailingTitleBracketSuffix(stripRecordVaultHtml(text)));
}

const TITLE_MATCH_BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function isRecordVaultAttachmentBlock(element) {
  return Boolean(element?.hasAttribute?.('data-rv-attachment'));
}

function isTitleMatchMediaBlock(element) {
  if (isRecordVaultAttachmentBlock(element)) return true;
  return Boolean(element?.querySelector?.('img, table, video, audio, iframe, canvas'));
}

function isTitleMatchEmptyBlock(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  if (isRecordVaultAttachmentBlock(element)) return false;
  const tag = element.tagName.toLowerCase();
  if (!TITLE_MATCH_BLOCK_TAGS.has(tag)) return false;
  if (isTitleMatchMediaBlock(element)) return false;
  return !normalizeTitleMatchPlain(element.textContent);
}

/**
 * Remove body rows that match the note title (case-insensitive).
 * Title is left alone — callers must not rewrite the title from body.
 * Trailing title suffixes like " [2]" / " [#]" are ignored when comparing.
 * Handles soft-break lines inside a single paragraph (`text<br>text`).
 * Runs across the whole body (not only leading rows) so matches below images
 * are removed too. Media blocks are preserved.
 */
export function stripLeadingTitleMatchingBodyRows(html, title) {
  try {
    const titlePlain = normalizeTitleForBodyMatch(title);
    const raw = String(html ?? '');
    if (!titlePlain || !raw.trim()) return raw;

    if (typeof document === 'undefined') {
      return stripTitleMatchingBodyRowsSsr(raw, titlePlain);
    }

    const template = document.createElement('template');
    template.innerHTML = sanitizeRecordVaultHtml(raw);
    const root = template.content;
    let removed = false;

    const stripBlock = (el) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        el.remove();
        removed = true;
        return;
      }
      if (!TITLE_MATCH_BLOCK_TAGS.has(tag)) return;
      if (isTitleMatchMediaBlock(el) || isRecordVaultAttachmentBlock(el)) return;

      const plain = normalizeTitleForBodyMatch(el.textContent);
      if (plain === titlePlain) {
        el.remove();
        removed = true;
        return;
      }

      // Soft-break rows inside one block: drop only the matching lines.
      const hasBr = Boolean(el.querySelector?.('br'));
      if (!hasBr) return;

      const segments = [];
      let current = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'br') {
          segments.push(current);
          current = [];
          continue;
        }
        current.push(child);
      }
      segments.push(current);

      const kept = segments.filter((seg) => {
        const text = seg.map((n) => n.textContent || '').join('');
        const segPlain = normalizeTitleForBodyMatch(text);
        if (!segPlain) return false;
        return segPlain !== titlePlain;
      });

      if (kept.length === segments.length) return;
      removed = true;
      if (kept.length === 0) {
        el.remove();
        return;
      }
      while (el.firstChild) el.removeChild(el.firstChild);
      kept.forEach((seg, idx) => {
        if (idx > 0) el.appendChild(document.createElement('br'));
        seg.forEach((n) => el.appendChild(n));
      });
    };

    for (const child of Array.from(root.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!String(child.textContent || '').trim()) {
          child.remove();
          removed = true;
        }
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        removed = true;
        continue;
      }
      stripBlock(child);
    }

    if (!removed) return raw;
    const out = String(template.innerHTML ?? '').trim();
    return out || '<p></p>';
  } catch {
    // Never crash note open / notebook switch on strip failures.
    return String(html ?? '') || '<p></p>';
  }
}

/** SSR / non-DOM: strip title-matching lines, including soft-break (`<br>`) lines. */
function stripTitleMatchingBodyRowsSsr(raw, titlePlain) {
  const MEDIA_RE = /<(img|table|video|audio|iframe|canvas)\b/i;

  const stripSoftBreakBlock = (blockHtml) => {
    if (MEDIA_RE.test(blockHtml)) return blockHtml;
    const parts = String(blockHtml).split(/<br\s*\/?>/i);
    if (parts.length <= 1) {
      const plain = normalizeTitleForBodyMatch(blockHtml);
      if (plain && plain === titlePlain) return '';
      return blockHtml;
    }
    const kept = parts.filter((part) => {
      const plain = normalizeTitleForBodyMatch(part);
      if (!plain) return false;
      return plain !== titlePlain;
    });
    if (kept.length === parts.length) return blockHtml;
    if (kept.length === 0) return '';
    return kept.join('<br>');
  };

  // Prefer splitting on block boundaries when HTML-ish; else plain lines.
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const chunks = raw.split(/(?=<p\b|<div\b|<h[1-6]\b|<img\b)/i).filter(Boolean);
    const out = [];
    for (const chunk of chunks) {
      if (MEDIA_RE.test(chunk) && !normalizeTitleForBodyMatch(chunk)) {
        out.push(chunk);
        continue;
      }
      const open = chunk.match(/^<(p|div|h[1-6])\b[^>]*>/i);
      const closeTag = open ? open[1].toLowerCase() : null;
      if (open && closeTag) {
        const closeRe = new RegExp(`</${closeTag}\\s*>$`, 'i');
        const inner = chunk.replace(/^<[a-z0-9]+\b[^>]*>/i, '').replace(closeRe, '');
        const nextInner = stripSoftBreakBlock(inner);
        if (!nextInner || !normalizeTitleForBodyMatch(nextInner)) {
          if (nextInner && MEDIA_RE.test(nextInner)) {
            out.push(`<${closeTag}>${nextInner}</${closeTag}>`);
          }
          // dropped empty / title-only block
          continue;
        }
        if (normalizeTitleForBodyMatch(nextInner) === titlePlain) continue;
        out.push(`<${closeTag}>${nextInner}</${closeTag}>`);
        continue;
      }
      const stripped = stripSoftBreakBlock(chunk);
      if (stripped) out.push(stripped);
    }
    const joined = out.join('').trim();
    return joined || '<p></p>';
  }

  const lines = raw.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (!normalizeTitleForBodyMatch(line)) {
      if (MEDIA_RE.test(line)) kept.push(line);
      continue;
    }
    if (normalizeTitleForBodyMatch(line) === titlePlain) continue;
    kept.push(line);
  }
  const joined = kept.join('\n').trim();
  return joined || '<p></p>';
}

/**
 * Collapse consecutive identical text rows (p / headings / div) to a single copy.
 * Media blocks and non-text structure are left alone. Case-insensitive.
 */
export function collapseAdjacentDuplicateBodyRows(html) {
  try {
    const raw = String(html ?? '');
    if (!raw.trim()) return raw;

    if (typeof document === 'undefined') {
      const lines = raw.split(/\r?\n/);
      const out = [];
      let prevPlain = null;
      for (const line of lines) {
        const plain = normalizeTitleMatchPlain(stripRecordVaultHtml(line));
        if (plain && prevPlain !== null && plain === prevPlain) continue;
        out.push(line);
        if (plain) prevPlain = plain;
      }
      const joined = out.join('\n').trim();
      return joined || '<p></p>';
    }

    const template = document.createElement('template');
    template.innerHTML = sanitizeRecordVaultHtml(raw);
    const root = template.content;
    let prevPlain = null;
    let removed = false;

    for (const child of Array.from(root.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br' || isTitleMatchEmptyBlock(child)) {
        // Empty / br rows don't break the consecutive-duplicate run.
        continue;
      }
      if (!TITLE_MATCH_BLOCK_TAGS.has(tag) || isTitleMatchMediaBlock(child)) {
        prevPlain = null;
        continue;
      }
      if (isRecordVaultAttachmentBlock(child)) {
        prevPlain = null;
        continue;
      }
      const plain = normalizeTitleMatchPlain(child.textContent);
      if (!plain) {
        continue;
      }
      if (prevPlain !== null && plain === prevPlain) {
        child.remove();
        removed = true;
        continue;
      }
      prevPlain = plain;
    }

    if (!removed) return raw;
    const out = String(template.innerHTML ?? '').trim();
    return out || '<p></p>';
  } catch {
    return String(html ?? '') || '<p></p>';
  }
}

/** Title-match strip + adjacent duplicate collapse for note body HTML. */
export function cleanRecordVaultNoteBodyHtml(html, title) {
  const afterTitle = stripLeadingTitleMatchingBodyRows(html, title);
  return collapseAdjacentDuplicateBodyRows(afterTitle);
}

function normalizeAttachmentLabelPlain(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function attachmentMeta(att) {
  const fileName = String(att?.file_name ?? att?.fileName ?? '').trim();
  const ext = String(att?.file_extension ?? att?.fileExtension ?? '').trim().toLowerCase();
  const base = fileName.replace(/\.[^.]+$/, '');
  return { fileName: fileName.toLowerCase(), base: base.toLowerCase(), ext };
}

/** Score how well a label paragraph matches a vault attachment (higher = better). */
export function scoreRecordVaultLabelForAttachment(labelText, att) {
  const text = normalizeAttachmentLabelPlain(labelText);
  if (!text) return 0;
  const { fileName, base, ext } = attachmentMeta(att);
  if (fileName && text.includes(fileName)) return 100;
  if (base && text.includes(base)) return 90;
  const textAlnum = text.replace(/[^a-z0-9]/g, '');
  const baseAlnum = base.replace(/[^a-z0-9]/g, '');
  if (baseAlnum.length >= 3 && textAlnum.includes(baseAlnum)) return 75;
  if (ext && (text.includes(`.${ext}`) || text.endsWith(ext))) return 55;
  if (ext === 'pdf' && text.includes('pdf')) return 50;
  if (ext === 'txt' && (text.includes('text') || text.includes('txt'))) return 50;
  if (ext === 'jpg' && (text.includes('jpg') || text.includes('jpeg') || text.includes('image'))) return 45;
  if (ext === 'png' && text.includes('png')) return 45;
  if (ext === 'mp4' && text.includes('mp4')) return 45;
  if (ext === 'mov' && text.includes('mov')) return 45;
  return 0;
}

/** True when the block is an extensions catalog (table cell / allowed-types list), not a caption. */
function isExtensionCatalogLabel(text) {
  const matches = String(text || '').match(/\.[a-z0-9]{2,5}\b/gi);
  return (matches?.length || 0) >= 2;
}

function labelIsInsideTable(el) {
  return Boolean(el?.closest?.('table, td, th'));
}

function hoistAttachmentsOutOfTables(root) {
  let moved = false;
  for (const div of Array.from(root.querySelectorAll('div[data-rv-attachment]'))) {
    const table = div.closest('table');
    if (!table) continue;
    table.after(div);
    moved = true;
  }
  return moved;
}

function nextMeaningfulElementSibling(el) {
  let n = el?.nextSibling;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE && !String(n.textContent || '').trim()) {
      n = n.nextSibling;
      continue;
    }
    if (n.nodeType === Node.ELEMENT_NODE) return n;
    n = n.nextSibling;
  }
  return null;
}

function createInlineAttachmentDiv(att) {
  const div = document.createElement('div');
  div.setAttribute('data-rv-attachment', '');
  const attId = att?.attachment_id ?? att?.attachmentId;
  if (attId != null) div.setAttribute('data-attachment-id', String(attId));
  const fileName = att?.file_name ?? att?.fileName;
  if (fileName) div.setAttribute('data-file-name', String(fileName));
  const ext = att?.file_extension ?? att?.fileExtension;
  if (ext) div.setAttribute('data-file-extension', String(ext));
  const size = att?.file_size_bytes ?? att?.fileSizeBytes;
  if (size != null) div.setAttribute('data-file-size', String(size));
  return div;
}

function liveAttachmentId(att) {
  return String(att?.attachment_id ?? att?.attachmentId ?? '').trim();
}

function liveAttachmentFileName(att) {
  return String(att?.file_name ?? att?.fileName ?? '').trim().toLowerCase();
}

function patchAttachmentDivFromLive(div, att) {
  const attId = liveAttachmentId(att);
  if (attId) div.setAttribute('data-attachment-id', attId);
  const fileName = att?.file_name ?? att?.fileName;
  if (fileName) div.setAttribute('data-file-name', String(fileName));
  const ext = att?.file_extension ?? att?.fileExtension;
  if (ext) div.setAttribute('data-file-extension', String(ext));
  const size = att?.file_size_bytes ?? att?.fileSizeBytes;
  if (size != null) div.setAttribute('data-file-size', String(size));
}

/**
 * Rewrite stale inline attachment ids (by filename), drop orphans/duplicates,
 * then sit each live file under its label when a label match exists.
 *
 * Fixes notes where top blocks keep dead ids ("Attachment not found") while the
 * same files were backfilled later with the real ids.
 */
export function realignBodyAttachmentBlocks(html, attachments) {
  const raw = String(html ?? '');
  if (!raw.trim() || typeof document === 'undefined') return raw;

  const liveList = Array.isArray(attachments) ? attachments.filter((a) => liveAttachmentId(a)) : [];
  if (!liveList.length) return raw;

  try {
    const template = document.createElement('template');
    template.innerHTML = sanitizeRecordVaultHtml(raw);
    const root = template.content;
    const liveById = new Map(liveList.map((att) => [liveAttachmentId(att), att]));
    const unusedByName = new Map();
    for (const att of liveList) {
      const name = liveAttachmentFileName(att);
      if (!name) continue;
      const list = unusedByName.get(name) || [];
      list.push(att);
      unusedByName.set(name, list);
    }

    const claimedIds = new Set();
    let changed = false;

    for (const div of Array.from(root.querySelectorAll('div[data-rv-attachment]'))) {
      const rawId = String(div.getAttribute('data-attachment-id') || '').trim();
      const name = String(div.getAttribute('data-file-name') || '').trim().toLowerCase();

      if (rawId && liveById.has(rawId) && !claimedIds.has(rawId)) {
        patchAttachmentDivFromLive(div, liveById.get(rawId));
        claimedIds.add(rawId);
        const fileKey = liveAttachmentFileName(liveById.get(rawId));
        const bucket = unusedByName.get(fileKey);
        if (bucket) {
          const idx = bucket.findIndex((a) => liveAttachmentId(a) === rawId);
          if (idx >= 0) bucket.splice(idx, 1);
        }
        continue;
      }

      const bucket = name ? unusedByName.get(name) : null;
      const match = bucket?.find((a) => !claimedIds.has(liveAttachmentId(a)));
      if (match) {
        patchAttachmentDivFromLive(div, match);
        claimedIds.add(liveAttachmentId(match));
        const idx = bucket.findIndex((a) => liveAttachmentId(a) === liveAttachmentId(match));
        if (idx >= 0) bucket.splice(idx, 1);
        changed = true;
        continue;
      }

      // Orphan or duplicate of an already-claimed live attachment.
      div.remove();
      changed = true;
    }

    const existingById = new Map();
    for (const div of Array.from(root.querySelectorAll('div[data-rv-attachment]'))) {
      const id = div.getAttribute('data-attachment-id');
      if (id) existingById.set(String(id), div);
    }

    const labelBlocks = Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6')).filter((el) => {
      if (isRecordVaultAttachmentBlock(el)) return false;
      if (isTitleMatchMediaBlock(el)) return false;
      if (labelIsInsideTable(el)) return false;
      if (isExtensionCatalogLabel(el.textContent)) return false;
      return Boolean(normalizeAttachmentLabelPlain(el.textContent));
    });

    const sortedAtts = [...liveList].sort((a, b) => {
      const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
      if (orderDiff !== 0) return orderDiff;
      return (Number(a.attachment_id) || 0) - (Number(b.attachment_id) || 0);
    });

    const claimedLabels = new Set();

    for (const att of sortedAtts) {
      const attId = liveAttachmentId(att);
      if (!attId) continue;

      let bestLabel = null;
      let bestScore = 0;
      for (const label of labelBlocks) {
        if (claimedLabels.has(label)) continue;
        const score = scoreRecordVaultLabelForAttachment(label.textContent, att);
        if (score > bestScore) {
          bestScore = score;
          bestLabel = label;
        }
      }
      if (!bestLabel || bestScore < 40) continue;

      let div = existingById.get(attId);
      if (!div) {
        div = createInlineAttachmentDiv(att);
        existingById.set(attId, div);
        changed = true;
      }

      const next = nextMeaningfulElementSibling(bestLabel);
      if (next === div) {
        claimedLabels.add(bestLabel);
        continue;
      }

      if (div.parentNode) div.remove();
      bestLabel.after(div);
      claimedLabels.add(bestLabel);
      changed = true;
    }

    if (hoistAttachmentsOutOfTables(root)) changed = true;

    if (!changed) return raw;
    const out = String(template.innerHTML ?? '').trim();
    return out || raw;
  } catch {
    return raw;
  }
}

/** True when saved HTML already references every attachment id inline. */
export function bodyHtmlHasInlineAttachmentIds(html, attachmentIds) {
  const body = String(html ?? '');
  if (!body || !Array.isArray(attachmentIds) || !attachmentIds.length) return false;
  return attachmentIds.every((id) => {
    const sid = String(id ?? '').trim();
    if (!sid) return true;
    return (
      body.includes(`data-attachment-id="${sid}"`) || body.includes(`data-attachment-id='${sid}'`)
    );
  });
}

function normalizeSectionMarkerPlain(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Legacy image-gap section dividers: ########################### rows and adjacent rules. */
export function isRecordVaultSectionMarkerPlain(text) {
  const t = normalizeSectionMarkerPlain(text);
  if (!t) return true;
  if (/^[#\-=_*·.]{5,}$/.test(t)) return true;
  return false;
}

export function stripRecordVaultSectionMarkers(html) {
  const raw = String(html ?? '');
  if (!raw.trim()) return '';
  if (typeof document === 'undefined') {
    return raw
      .replace(/<hr\b[^>]*>/gi, '')
      .replace(/<p[^>]*>\s*[#\-=_*·.]{5,}\s*<\/p>/gi, '')
      .replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');
  }

  const template = document.createElement('template');
  template.innerHTML = sanitizeRecordVaultHtml(raw);

  const isEmptyBlock = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = element.tagName.toLowerCase();
    if (tag !== 'p' && tag !== 'div') return false;
    const plain = normalizeSectionMarkerPlain(element.textContent);
    if (isRecordVaultSectionMarkerPlain(plain)) return true;
    if (!plain && !element.querySelector('img,table,ul,ol,blockquote,pre,h1,h2,h3')) return true;
    return false;
  };

  const prune = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'hr' || isEmptyBlock(child)) {
        child.remove();
        continue;
      }
      prune(child);
    }
  };

  prune(template.content);

  let out = template.innerHTML;
  while (/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/i.test(out)) {
    out = out.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');
  }
  return out.trim();
}

export function recordVaultBodyHasSectionMarkers(value) {
  const raw = String(value ?? '');
  if (!raw.trim()) return false;
  const stripped = stripRecordVaultSectionMarkers(raw);
  if (typeof document === 'undefined') {
    return normalizeRecordVaultPlainBodyText(stripped) !== normalizeRecordVaultPlainBodyText(raw);
  }
  return sanitizeRecordVaultHtml(stripped) !== sanitizeRecordVaultHtml(raw);
}
