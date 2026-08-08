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
  'data-file-size',
  'data-width',
  'data-height',
  'data-pos-left',
  'data-pos-top',
  'data-frame-left',
  'data-frame-top',
  'data-frame-width',
  'data-frame-height',
  'data-pan-x',
  'data-pan-y'
]);

const ALBUM_TEMPLATE_DIV_ATTRS = new Set([
  'data-rv-album-template',
  'data-template-id',
  'data-template-h',
  'data-template-w',
  'data-template-x',
  'data-template-y',
  'data-album-templates',
  'style'
]);

const ALBUM_STAGING_DIV_ATTRS = new Set(['data-rv-album-staging', 'data-staging-json', 'style']);

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
export function sanitizePhotoAlbumsHtml(html) {
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
        // TipTap vault file / photo attachment atoms — keep placement attrs.
        if (child.hasAttribute('data-rv-attachment')) {
          for (const attr of Array.from(child.attributes)) {
            if (!ATTACHMENT_DIV_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
          }
          child.setAttribute('data-rv-attachment', '');
          continue;
        }
        // Album page template marker (persisted with the note body).
        if (child.hasAttribute('data-rv-album-template')) {
          for (const attr of Array.from(child.attributes)) {
            if (!ALBUM_TEMPLATE_DIV_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
          }
          child.setAttribute('data-rv-album-template', '');
          if (!child.getAttribute('style')) child.setAttribute('style', 'display:none');
          continue;
        }
        if (child.hasAttribute('data-rv-album-staging')) {
          for (const attr of Array.from(child.attributes)) {
            if (!ALBUM_STAGING_DIV_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
          }
          child.setAttribute('data-rv-album-staging', '');
          if (!child.getAttribute('style')) child.setAttribute('style', 'display:none');
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
export function normalizeClipboardHtmlForPhotoAlbums(html) {
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

  return sanitizePhotoAlbumsHtml(out.innerHTML);
}

export function stripPhotoAlbumsHtml(html) {
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

export const PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN =
  'Please Edit title above, add text, docs, and image here. File type accept are: jpg, jpeg, png, gif, webp, svg, avif, tif, bmp, heic, raw, psd, ai, eps, ico, pdf, doc, docx, xls, xlsx, ppt, pptx, json, csv, javascript, zip, mp3, mp4, txt, yaml, css, xml, tar, gz, xz';

function normalizePhotoAlbumsPlainBodyText(value) {
  return stripPhotoAlbumsHtml(value).replace(/\s+/g, ' ').trim();
}

export function isPhotoAlbumsLegacyDefaultBodyText(value) {
  return (
    normalizePhotoAlbumsPlainBodyText(value) ===
    normalizePhotoAlbumsPlainBodyText(PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN)
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Drop the old default intro paragraph when it is saved alone or before real note content. */
export function removePhotoAlbumsLegacyDefaultBodyIntro(value) {
  const raw = String(value ?? '');
  if (!raw || isPhotoAlbumsLegacyDefaultBodyText(raw)) return '';

  const legacyPlain = normalizePhotoAlbumsPlainBodyText(PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN);
  const plain = normalizePhotoAlbumsPlainBodyText(raw);
  if (!plain.startsWith(legacyPlain)) return raw;

  const restPlain = plain.slice(legacyPlain.length).trim();
  if (!restPlain) return '';

  const legacyHtmlPattern = new RegExp(
    `^\\s*<p[^>]*>\\s*${escapeRegExp(PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN)}\\s*</p>\\s*`,
    'i'
  );
  const withoutHtmlParagraph = raw.replace(legacyHtmlPattern, '').trimStart();
  if (withoutHtmlParagraph !== raw) return withoutHtmlParagraph;

  const legacyPlainPattern = new RegExp(`^\\s*${escapeRegExp(PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN)}\\s*`, 'i');
  const withoutPlainPrefix = raw.replace(legacyPlainPattern, '').trimStart();
  if (withoutPlainPrefix !== raw) return withoutPlainPrefix;

  return plainTextToEditorHtml(restPlain);
}

export function clearPhotoAlbumsLegacyDefaultBodyText(value) {
  return removePhotoAlbumsLegacyDefaultBodyIntro(value);
}

export function photoAlbumsBodyHasLegacyIntro(value) {
  const raw = String(value ?? '');
  if (!raw) return false;
  if (isPhotoAlbumsLegacyDefaultBodyText(raw)) return true;
  const legacyPlain = normalizePhotoAlbumsPlainBodyText(PHOTO_ALBUMS_LEGACY_DEFAULT_BODY_PLAIN);
  return normalizePhotoAlbumsPlainBodyText(raw).startsWith(legacyPlain);
}

export function photoAlbumsRichTextHasContent(value) {
  return Boolean(stripPhotoAlbumsHtml(value).trim());
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
  return normalizeTitleMatchPlain(stripTrailingTitleBracketSuffix(stripPhotoAlbumsHtml(text)));
}

const TITLE_MATCH_BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function isTitleMatchMediaBlock(element) {
  return Boolean(element?.querySelector?.('img, table, video, audio, iframe, canvas'));
}

function isTitleMatchEmptyBlock(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
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
    template.innerHTML = sanitizePhotoAlbumsHtml(raw);
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
      if (isTitleMatchMediaBlock(el)) return;

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
        const plain = normalizeTitleMatchPlain(stripPhotoAlbumsHtml(line));
        if (plain && prevPlain !== null && plain === prevPlain) continue;
        out.push(line);
        if (plain) prevPlain = plain;
      }
      const joined = out.join('\n').trim();
      return joined || '<p></p>';
    }

    const template = document.createElement('template');
    template.innerHTML = sanitizePhotoAlbumsHtml(raw);
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
export function cleanPhotoAlbumsNoteBodyHtml(html, title) {
  const afterTitle = stripLeadingTitleMatchingBodyRows(html, title);
  const afterJunk = stripPhotoAlbumsDragJunkBodyRows(afterTitle);
  return collapseAdjacentDuplicateBodyRows(afterJunk);
}

/**
 * Accidental TipTap inserts from vault / Finder / filmstrip drags that missed a slot
 * (e.g. lone "Set 1-Album 1.html", "pa-staged:12", "Album page 2").
 */
export function isPhotoAlbumsDragJunkPlain(text) {
  const t = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (/^pa-staged:\d+$/i.test(t)) return true;
  if (/^Album page \d+$/i.test(t)) return true;
  // DownloadURL payload sometimes lands as visible text.
  if (/^text\/html:[^:\r\n]+\.html?:/i.test(t)) return true;
  // Lone export / Finder filename (spaces ok: "Set 1-Album 1.html").
  if (t.length <= 180 && /^[^<>\r\n]+\.html?$/i.test(t)) return true;
  return false;
}

/** Remove body paragraphs / soft-break lines that are only drag-junk filenames. */
export function stripPhotoAlbumsDragJunkBodyRows(html) {
  const raw = String(html ?? '');
  if (!raw.trim()) return raw || '<p></p>';

  const stripPlainSegments = (inner) => {
    const parts = String(inner || '').split(/<br\s*\/?\s*>/i);
    const kept = parts.filter((seg) => {
      const plain = String(seg || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return plain && !isPhotoAlbumsDragJunkPlain(plain);
    });
    return kept.join('<br>');
  };

  if (typeof document === 'undefined') {
    return raw
      .replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (block) => {
        const inner = block.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>$/i, '');
        const plain = String(inner)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (isPhotoAlbumsDragJunkPlain(plain)) return '';
        const nextInner = stripPlainSegments(inner);
        if (!String(nextInner).replace(/<[^>]+>/g, '').trim()) return '';
        return block.replace(inner, nextInner);
      })
      .replace(/(^|>)\s*[^<>\r\n]+\.html?\s*(<|$)/gi, (m, a, b) => {
        const mid = m.slice(a.length, m.length - b.length).trim();
        return isPhotoAlbumsDragJunkPlain(mid) ? `${a}${b}` : m;
      });
  }

  try {
    const template = document.createElement('template');
    template.innerHTML = raw;
    const blocks = template.content.querySelectorAll('p, div');
    blocks.forEach((el) => {
      const plain = String(el.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (isPhotoAlbumsDragJunkPlain(plain)) {
        el.remove();
        return;
      }
      // Soft-break lines inside one paragraph.
      if (/<br\s*\/?\s*>/i.test(el.innerHTML) && el.childNodes.length) {
        const htmlInner = el.innerHTML;
        const nextInner = stripPlainSegments(htmlInner);
        if (nextInner !== htmlInner) {
          if (!String(nextInner).replace(/<[^>]+>/g, '').trim()) el.remove();
          else el.innerHTML = nextInner;
        }
      }
    });
    const out = String(template.innerHTML ?? '').trim();
    return out || '<p></p>';
  } catch {
    return raw;
  }
}

function normalizeSectionMarkerPlain(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Legacy image-gap section dividers: ########################### rows and adjacent rules. */
export function isPhotoAlbumsSectionMarkerPlain(text) {
  const t = normalizeSectionMarkerPlain(text);
  if (!t) return true;
  if (/^[#\-=_*·.]{5,}$/.test(t)) return true;
  return false;
}

export function stripPhotoAlbumsSectionMarkers(html) {
  const raw = String(html ?? '');
  if (!raw.trim()) return '';
  if (typeof document === 'undefined') {
    return raw
      .replace(/<hr\b[^>]*>/gi, '')
      .replace(/<p[^>]*>\s*[#\-=_*·.]{5,}\s*<\/p>/gi, '')
      .replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');
  }

  const template = document.createElement('template');
  template.innerHTML = sanitizePhotoAlbumsHtml(raw);

  const isEmptyBlock = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = element.tagName.toLowerCase();
    if (tag !== 'p' && tag !== 'div') return false;
    const plain = normalizeSectionMarkerPlain(element.textContent);
    if (isPhotoAlbumsSectionMarkerPlain(plain)) return true;
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

export function photoAlbumsBodyHasSectionMarkers(value) {
  const raw = String(value ?? '');
  if (!raw.trim()) return false;
  const stripped = stripPhotoAlbumsSectionMarkers(raw);
  if (typeof document === 'undefined') {
    return normalizePhotoAlbumsPlainBodyText(stripped) !== normalizePhotoAlbumsPlainBodyText(raw);
  }
  return sanitizePhotoAlbumsHtml(stripped) !== sanitizePhotoAlbumsHtml(raw);
}
