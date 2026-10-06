/**
 * Clipboard paste helpers for Record Vault / TutaNotes.
 *
 * Goal: Select All → Copy from Apple Notes (or Word / LibreOffice / browser) →
 * Paste into /myNote with as much text + images as the browser clipboard exposes.
 *
 * Same code path on Mac and Ubuntu — no OS branching. The browser only gives us
 * whatever is on the web clipboard (text/html, text/plain, image files, blob: imgs).
 * Proprietary Apple pasteboard types are never visible to JS; we make the best of
 * what is exposed.
 *
 * Apple Notes quirk: HTML often has <img src="webkit-fake-url:..."> placeholders
 * while the real image bytes are only on navigator.clipboard.read() — not always
 * in clipboardData during the paste event. We merge both sources.
 */
import { isNeutralCssColor } from './recordVaultNeutralColors';

/** Only these img srcs render in the editor; everything else is a placeholder to fill or drop. */
const USABLE_IMG_SRC = /^(data:image\/|blob:|https?:|\/\/|\/(?!\/))/i;

/** Apple NSAttributedString attachment marker — where an image sat in the copied note. */
const OBJECT_REPLACEMENT_CHAR_RE = /\uFFFC/g;
const PASTE_IMAGE_SLOT_HTML = '<img src="#">';

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'A',
  'IMG',
  'FIGURE',
  'PICTURE',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'BLOCKQUOTE',
  'PRE',
  'CODE',
  'HR',
  'SUB',
  'SUP',
  'MARK'
]);

/**
 * webkit-fake-url:, file:, cid:, "#", and bare relative names like
 * "Pasted Graphic.png" (Apple RTFD → HTML) are unreachable from the browser.
 */
export function isUnusableImageSrc(src) {
  const s = String(src || '').trim();
  if (!s) return true;
  return !USABLE_IMG_SRC.test(s);
}

export function countObjectReplacementChars(text) {
  return (String(text || '').match(OBJECT_REPLACEMENT_CHAR_RE) || []).length;
}

function objectReplacementCharsToImageSlots(html) {
  return String(html || '').replace(OBJECT_REPLACEMENT_CHAR_RE, PASTE_IMAGE_SLOT_HTML);
}

function fileDedupeKey(file) {
  return `${file?.name || ''}:${file?.size || 0}:${file?.type || ''}:${file?.lastModified || 0}`;
}

function compactHtmlForCompare(html) {
  return String(html || '')
    .replace(/\s+/g, '')
    .replace(/src="data:image[^"]+"/gi, 'src="data:img"')
    .toLowerCase();
}

/**
 * Apple Notes (and some Word exports) sometimes put the same block twice in one HTML
 * payload — looks like "paste ran twice" but it is one insert of duplicated markup.
 */
export function dedupeMirroredPasteHtml(html) {
  const normalized = String(html || '').trim();
  if (!normalized) return normalized;

  if (normalized.length >= 80) {
    const half = Math.floor(normalized.length / 2);
    const a = compactHtmlForCompare(normalized.slice(0, half));
    const b = compactHtmlForCompare(normalized.slice(half));
    if (a.length > 40 && a === b) {
      return normalized.slice(0, half).trim();
    }
  }

  if (typeof DOMParser === 'undefined') return normalized;

  const doc = new DOMParser().parseFromString(
    `<div id="rv-dedupe-root">${normalized}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-dedupe-root');
  const kids = [...(root?.children || [])];

  const dedupeChildList = (elements) => {
    if (elements.length >= 2) {
      if (elements.length % 2 === 0) {
        const mid = elements.length / 2;
        const left = elements.slice(0, mid).map((k) => compactHtmlForCompare(k.outerHTML)).join('');
        const right = elements.slice(mid).map((k) => compactHtmlForCompare(k.outerHTML)).join('');
        if (left.length > 40 && left === right) {
          return elements.slice(0, mid);
        }
      }

      const deduped = [];
      let prevCompact = '';
      for (const kid of elements) {
        const compact = compactHtmlForCompare(kid.outerHTML);
        if (compact.length > 40 && compact === prevCompact) continue;
        prevCompact = compact;
        deduped.push(kid);
      }
      if (deduped.length < elements.length) return deduped;
    }
    return elements;
  };

  let nextKids = dedupeChildList(kids);
  if (nextKids.length === 1 && nextKids[0]?.children?.length >= 2) {
    const inner = [...nextKids[0].children];
    const dedupedInner = dedupeChildList(inner);
    if (dedupedInner.length < inner.length) {
      nextKids[0].innerHTML = dedupedInner.map((k) => k.outerHTML).join('');
    }
  }

  if (nextKids.length < kids.length || nextKids.some((k, i) => k !== kids[i])) {
    return nextKids.map((k) => k.outerHTML).join('');
  }

  return normalized;
}

/** Fingerprint clipboard payload so duplicate paste events within one user action are ignored. */
export function recordVaultPasteSignature(clipboardData) {
  if (!clipboardData) return '';
  const html = String(clipboardData.getData('text/html') || '');
  const plain = String(clipboardData.getData('text/plain') || '');
  const files = collectClipboardImageFiles(clipboardData);
  const filePart = files.map((f) => `${f.size}:${f.type}`).join(',');
  const htmlKey = html.length > 160 ? `${html.length}:${html.slice(0, 80)}:${html.slice(-80)}` : html;
  return `${htmlKey}|${plain.length}:${plain.slice(0, 64)}|${filePart}`;
}

function countDataUrlImages(html) {
  return (String(html || '').match(/<img\b[^>]*\ssrc="data:image/gi) || []).length;
}

export function dedupeImageFilesBySizeType(files) {
  const out = [];
  const seen = new Set();
  for (const file of files || []) {
    if (!file) continue;
    const key = `${file.size || 0}:${String(file.type || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

export function dedupeImageFiles(files) {
  const out = [];
  const seen = new Set();
  for (const file of files || []) {
    if (!file || typeof file !== 'object') continue;
    const key = fileDedupeKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return dedupeImageFilesBySizeType(out);
}

function isLikelyImageFile(file) {
  if (!file || typeof file !== 'object') return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (!type || type === 'application/octet-stream') return true;
  return false;
}

export function collectClipboardImageFiles(clipboardData) {
  if (!clipboardData) return [];
  const out = [];

  const push = (file) => {
    if (!isLikelyImageFile(file)) return;
    const key = fileDedupeKey(file);
    if (out.some((f) => fileDedupeKey(f) === key)) return;
    out.push(file);
  };

  if (clipboardData.files?.length) {
    for (let i = 0; i < clipboardData.files.length; i += 1) push(clipboardData.files[i]);
  }

  if (clipboardData.items?.length) {
    for (let i = 0; i < clipboardData.items.length; i += 1) {
      const item = clipboardData.items[i];
      if (!item || item.kind !== 'file') continue;
      try {
        push(item.getAsFile());
      } catch {
        // ignore
      }
    }
  }

  return dedupeImageFiles(out);
}

/**
 * Chromium / Safari on Mac: Apple Notes often exposes multiple image/png blobs here
 * when clipboardData.items only had text/html + text/plain during paste.
 */
export async function readClipboardImageFilesAsync() {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return [];
  try {
    const items = await navigator.clipboard.read();
    const out = [];
    for (const item of items) {
      for (const type of item.types || []) {
        if (!String(type).startsWith('image/')) continue;
        try {
          const blob = await item.getType(type);
          if (!blob) continue;
          const ext = String(type).split('/')[1] || 'png';
          const file =
            blob instanceof File
              ? blob
              : new File([blob], `paste-${out.length + 1}.${ext}`, { type });
          out.push(file);
        } catch {
          // skip unreadable type
        }
      }
    }
    return dedupeImageFiles(out);
  } catch (err) {
    console.warn('[RecordVault paste] navigator.clipboard.read() failed:', err?.message || err);
    return [];
  }
}

export function htmlHintsImages(html) {
  const s = String(html || '');
  if (!s) return false;
  return (
    /<img\b/i.test(s) ||
    /\uFFFC/.test(s) ||
    /webkit-fake-url:/i.test(s) ||
    /\bx-apple-/i.test(s) ||
    /AppleAttachment/i.test(s) ||
    /apple-inline-image/i.test(s)
  );
}

export function countUnmaterializedImages(html) {
  if (typeof DOMParser === 'undefined') return 0;
  const doc = new DOMParser().parseFromString(
    `<div id="rv-count-root">${String(html || '')}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-count-root') || doc.body;
  let count = 0;
  for (const img of root?.querySelectorAll('img') || []) {
    const src = img.getAttribute('src') || '';
    if (/^blob:/i.test(src) || isUnusableImageSrc(src)) count += 1;
  }
  return count;
}

/**
 * Chrome on Mac often drops Apple Notes images from the paste-event HTML entirely
 * (no <img>, no placeholder), so rich pastes with no image files also ask the
 * async clipboard — the only place those bytes may still be exposed.
 */
async function resolveImageFilesForPaste(clipboardData, htmlRaw, normalizedHtml) {
  let files = collectClipboardImageFiles(clipboardData);
  const placeholders = countUnmaterializedImages(normalizedHtml);
  const richPasteWithoutFiles = Boolean(String(htmlRaw || '').trim()) && files.length === 0;

  const needsAsync = (placeholders > 0 && placeholders > files.length) || richPasteWithoutFiles;

  if (needsAsync) {
    const asyncFiles = await readClipboardImageFilesAsync();
    files = dedupeImageFiles([...files, ...asyncFiles]);
  }

  return files;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

async function blobUrlToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blob fetch ${res.status}`);
  const blob = await res.blob();
  return fileToDataUrl(blob);
}

function unwrapAppleFragment(html) {
  let s = String(html || '');
  const start = s.indexOf('<!--StartFragment-->');
  const end = s.indexOf('<!--EndFragment-->');
  if (start >= 0 && end > start) {
    s = s.slice(start + '<!--StartFragment-->'.length, end);
  }
  return s;
}

export function plainTextToHtml(plain) {
  const escaped = String(plain || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split(/\n/).join('<br>');
      return `<p>${lines || '<br>'}</p>`;
    })
    .join('');
  return paragraphs || '<p></p>';
}

/*
 * Web-page paste (amazon.com etc.): Chrome/Safari serialize the copied DOM with
 * the page's matched CSS inlined on every element (font-size, color, background,
 * display:flex/grid, widths). The editor can't keep arbitrary CSS, so we:
 *  - resolve inherited text styling and put it on each text run (TextStyle marks),
 *  - turn side-by-side image cards (flex rows / grids) into a table,
 *  - keep pixel image widths and centered/right alignment.
 */
const FLAT_STYLE_ATTR = 'data-rv-flat';
const ALIGN_ATTR = 'data-rv-align';
export const PASTE_IMG_HEIGHT_ATTR = 'data-rv-img-h';
export const PASTE_IMG_MAX_W_ATTR = 'data-rv-img-maxw';
export const PASTE_IMG_MAX_H_ATTR = 'data-rv-img-maxh';

const MAX_LAYOUT_COLUMNS = 6;
const DEFAULT_LAYOUT_COLUMNS = 4;
const INLINE_FLEX_MAX_TEXT = 200;
const MIN_FONT_PX = 6;
const MAX_FONT_PX = 96;
const MAX_PASTED_IMAGE_WIDTH = 1600;
const CSS_WIDE_KEYWORD = /^(inherit|initial|unset|revert|revert-layer)$/i;
const ALIGNABLE_BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE']);
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;
const FONT_SIZE_KEYWORDS = {
  'xx-small': 9,
  'x-small': 10,
  small: 13,
  medium: 16,
  large: 18,
  'x-large': 24,
  'xx-large': 32
};

function cssValue(el, prop) {
  return String(el?.style?.getPropertyValue?.(prop) || '').trim();
}

function pxValue(raw) {
  const m = String(raw || '').trim().match(/^(\d*\.?\d+)px$/i);
  return m ? parseFloat(m[1]) : null;
}

function pixelAttr(el, name) {
  const m = String(el?.getAttribute?.(name) || '').trim().match(/^(\d+)(px)?$/i);
  return m ? parseInt(m[1], 10) : null;
}

function isVisibleColor(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || CSS_WIDE_KEYWORD.test(v)) return false;
  if (v === 'transparent' || v === 'none' || v === 'currentcolor') return false;
  if (/^rgba\(.*,\s*0(\.0+)?\s*\)$/.test(v)) return false;
  return true;
}

/** `background: none 0% 0% / auto repeat … rgb(240, 242, 242)` → `rgb(240, 242, 242)`. */
function backgroundColorOf(el) {
  const direct = cssValue(el, 'background-color');
  if (isVisibleColor(direct)) return direct;
  const shorthand = cssValue(el, 'background');
  const colors = shorthand.match(/(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b)/gi);
  const last = colors?.[colors.length - 1];
  return isVisibleColor(last) ? last : null;
}

function resolveFontSizePx(raw, parentPx) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v || CSS_WIDE_KEYWORD.test(v)) return null;
  if (FONT_SIZE_KEYWORDS[v]) return FONT_SIZE_KEYWORDS[v];
  const m = v.match(/^(\d*\.?\d+)(px|pt|rem|em|%)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const base = parentPx || 16;
  if (m[2] === 'px') return n;
  if (m[2] === 'pt') return (n * 4) / 3;
  if (m[2] === 'rem') return n * 16;
  if (m[2] === 'em') return n * base;
  return (n / 100) * base;
}

function isBoldWeight(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'bold' || v === 'bolder') return true;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 600;
}

function normalizeAlign(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'center' || v === '-webkit-center') return 'center';
  if (v === 'right' || v === 'end' || v === '-webkit-right') return 'right';
  if (v === 'justify') return 'justify';
  if (v === 'left' || v === 'start' || v === '-webkit-left') return 'left';
  return null;
}

function flatTextStyle(ctx) {
  const parts = [];
  if (ctx.color) parts.push(`color: ${ctx.color}`);
  if (ctx.background) parts.push(`background-color: ${ctx.background}`);
  if (ctx.fontSize) {
    const px = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, ctx.fontSize));
    parts.push(`font-size: ${Math.round(px * 10) / 10}px`);
  }
  if (ctx.fontFamily) parts.push(`font-family: ${ctx.fontFamily}`);
  if (ctx.bold) parts.push('font-weight: 700');
  if (ctx.italic) parts.push('font-style: italic');
  const deco = [ctx.underline && 'underline', ctx.strike && 'line-through'].filter(Boolean);
  if (deco.length) parts.push(`text-decoration: ${deco.join(' ')}`);
  return parts.join('; ');
}

/**
 * Resolve CSS inheritance down the pasted tree and wrap every text run in a
 * <span style> carrying its effective color / size / family / weight / background.
 * Block alignment is recorded on ALIGN_ATTR for the paragraph pass.
 */
function flattenInheritedTextStyles(doc, root) {
  const visit = (el, ctx) => {
    const next = { ...ctx };

    // Neutral colors reset to the note theme (see recordVaultNeutralColors).
    const color = cssValue(el, 'color') || (el.tagName === 'FONT' ? el.getAttribute('color') : '');
    if (isVisibleColor(color)) next.color = isNeutralCssColor(color) ? null : color;

    const fontSize = resolveFontSizePx(cssValue(el, 'font-size'), ctx.fontSize);
    if (fontSize) next.fontSize = fontSize;

    const family = cssValue(el, 'font-family') || (el.tagName === 'FONT' ? el.getAttribute('face') : '');
    if (family && !CSS_WIDE_KEYWORD.test(family)) next.fontFamily = family;

    const weight = cssValue(el, 'font-weight');
    if (weight && !CSS_WIDE_KEYWORD.test(weight)) next.bold = isBoldWeight(weight);

    const fontStyle = cssValue(el, 'font-style');
    if (fontStyle && !CSS_WIDE_KEYWORD.test(fontStyle)) next.italic = /italic|oblique/i.test(fontStyle);

    const deco = `${cssValue(el, 'text-decoration-line')} ${cssValue(el, 'text-decoration')}`;
    if (/underline/i.test(deco)) next.underline = true;
    if (/line-through/i.test(deco)) next.strike = true;

    const bg = backgroundColorOf(el);
    if (bg) next.background = isNeutralCssColor(bg) ? null : bg;

    const align = normalizeAlign(cssValue(el, 'text-align') || el.getAttribute('align'));
    if (align) next.align = align;
    if (ALIGNABLE_BLOCK_TAGS.has(el.tagName) && next.align && next.align !== 'left') {
      el.setAttribute(ALIGN_ATTR, next.align);
    }

    for (const child of [...el.childNodes]) {
      if (child.nodeType === 1) {
        visit(child, next);
      } else if (child.nodeType === 3 && child.nodeValue.trim()) {
        const style = flatTextStyle(next);
        if (!style) continue;
        const span = doc.createElement('span');
        span.setAttribute('style', style);
        span.setAttribute(FLAT_STYLE_ATTR, '');
        child.replaceWith(span);
        span.appendChild(child);
      }
    }
  };

  for (const child of [...root.children]) visit(child, {});
}

function hasVisibleContent(el) {
  return el.tagName === 'IMG' || Boolean(el.querySelector('img')) || Boolean(el.textContent?.trim());
}

function countGridTracks(value) {
  const v = String(value || '').replace(/\[[^\]]*\]/g, ' ').trim();
  if (!v || v === 'none' || CSS_WIDE_KEYWORD.test(v)) return 0;
  const repeat = v.match(/^repeat\(\s*(\d+)\s*,/i);
  if (repeat) return parseInt(repeat[1], 10);
  let depth = 0;
  let tracks = 0;
  let inToken = false;
  for (const ch of v) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      inToken = false;
    } else if (!inToken) {
      inToken = true;
      tracks += 1;
    }
  }
  return tracks;
}

function layoutColumnCount(el, isGrid, kids) {
  let cols = 0;
  if (isGrid) {
    cols = countGridTracks(cssValue(el, 'grid-template-columns'));
  } else if (/wrap/i.test(cssValue(el, 'flex-wrap'))) {
    const containerW = pxValue(cssValue(el, 'width'));
    const kidW = pxValue(cssValue(kids[0], 'width'));
    if (containerW && kidW) cols = Math.floor((containerW + 1) / kidW);
  }
  if (!cols) cols = kids.length <= MAX_LAYOUT_COLUMNS ? kids.length : DEFAULT_LAYOUT_COLUMNS;
  return Math.max(1, Math.min(cols, MAX_LAYOUT_COLUMNS, kids.length));
}

function buildLayoutTable(doc, container, kids, cols) {
  const table = doc.createElement('table');
  const tbody = doc.createElement('tbody');
  for (let i = 0; i < kids.length; i += cols) {
    const tr = doc.createElement('tr');
    for (let c = 0; c < cols; c += 1) {
      const td = doc.createElement('td');
      const kid = kids[i + c];
      if (kid) {
        const bg = backgroundColorOf(kid);
        if (bg && !isNeutralCssColor(bg)) td.setAttribute('style', `background-color: ${bg}`);
        td.appendChild(kid);
      } else {
        td.innerHTML = '<p></p>';
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.replaceChildren(table);
}

function renameElement(doc, el, tagName) {
  const next = doc.createElement(tagName);
  for (const attr of [...el.attributes]) next.setAttribute(attr.name, attr.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

/** Short text-only flex row (badge + label, price parts) → one inline line. */
function inlineFlexRow(doc, kids) {
  kids.forEach((kid, index) => {
    [...kid.querySelectorAll('div, p')].reverse().forEach((blk) => renameElement(doc, blk, 'span'));
    const inlineKid = /^(DIV|P|LI)$/.test(kid.tagName) ? renameElement(doc, kid, 'span') : kid;
    if (index > 0) inlineKid.before(doc.createTextNode(' '));
  });
}

/**
 * Flex rows and CSS grids of image cards (product carousels, 2×2 deal tiles)
 * become a table so they stay side by side; everything else stacks as blocks.
 */
function convertLayoutContainers(doc, root) {
  const containers = [...root.querySelectorAll('*')]
    .filter((el) => /^(inline-)?(flex|grid)$/i.test(cssValue(el, 'display')))
    .reverse();

  for (const el of containers) {
    if (!root.contains(el)) continue;
    const isGrid = /grid$/i.test(cssValue(el, 'display'));
    if (!isGrid && /^column/i.test(cssValue(el, 'flex-direction'))) continue;

    const kids = [...el.children].filter(hasVisibleContent);
    if (kids.length < 2) continue;

    const imageKids = kids.filter((k) => k.tagName === 'IMG' || k.querySelector('img'));
    if (imageKids.length >= 2) {
      const cols = layoutColumnCount(el, isGrid, kids);
      if (cols >= 2) buildLayoutTable(doc, el, kids, cols);
      continue;
    }

    const textOnly =
      !imageKids.length && !kids.some((k) => k.querySelector('table, ul, ol, pre, blockquote, h1, h2, h3, h4'));
    if (!isGrid && textOnly && (el.textContent || '').trim().length <= INLINE_FLEX_MAX_TEXT) {
      inlineFlexRow(doc, kids);
    }
  }
}

/** Keep the rendered pixel size of pasted <img>; height-only / max-size hints resolve after load. */
function recordPastedImageSize(img) {
  const width = pxValue(cssValue(img, 'width')) || pixelAttr(img, 'width');
  if (width) {
    img.setAttribute('width', String(Math.min(MAX_PASTED_IMAGE_WIDTH, Math.round(width))));
    return;
  }
  img.removeAttribute('width');
  const height = pxValue(cssValue(img, 'height')) || pixelAttr(img, 'height');
  const maxW = pxValue(cssValue(img, 'max-width'));
  const maxH = pxValue(cssValue(img, 'max-height'));
  if (height) img.setAttribute(PASTE_IMG_HEIGHT_ATTR, String(Math.round(height)));
  if (maxW) img.setAttribute(PASTE_IMG_MAX_W_ATTR, String(Math.round(maxW)));
  if (maxH) img.setAttribute(PASTE_IMG_MAX_H_ATTR, String(Math.round(maxH)));
}

/** Evernote app clipboard: images are `en-cache://` refs into Evernote's private cache. */
export function isEvernoteClipboardHtml(html) {
  return /en-cache:\/\//i.test(String(html || '')) || /data-en-clipboard/i.test(String(html || ''));
}

/** Evernote renders file attachments as <img data-type="text/plain"> cards; not pictures. */
function replaceEvernoteAttachmentCards(doc, root) {
  root.querySelectorAll('img[data-type]').forEach((img) => {
    const type = String(img.getAttribute('data-type') || '').toLowerCase();
    if (!type || type.startsWith('image/')) return;
    const p = doc.createElement('p');
    p.textContent = `[Evernote attachment (${type}) — not included when copying]`;
    img.replaceWith(p);
  });
}

function isHiddenElement(el) {
  return (
    el.hasAttribute('hidden') ||
    /^none$/i.test(cssValue(el, 'display')) ||
    /^hidden$/i.test(cssValue(el, 'visibility'))
  );
}

/**
 * Strip Apple / Office junk and keep TipTap-friendly markup.
 */
export function normalizePastedHtml(html) {
  if (typeof DOMParser === 'undefined') {
    return objectReplacementCharsToImageSlots(unwrapAppleFragment(html));
  }

  const raw = objectReplacementCharsToImageSlots(unwrapAppleFragment(html));
  const doc = new DOMParser().parseFromString(
    `<div id="rv-paste-root">${raw}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-paste-root') || doc.body;
  if (!root) return plainTextToHtml('');

  root.querySelectorAll('script, style, meta, link, title, xml, head, noscript, template').forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    if (isHiddenElement(el)) el.remove();
  });

  replaceEvernoteAttachmentCards(doc, root);
  root.querySelectorAll('img').forEach(recordPastedImageSize);
  flattenInheritedTextStyles(doc, root);
  convertLayoutContainers(doc, root);

  root.querySelectorAll('[style]').forEach((el) => {
    if (el.hasAttribute(FLAT_STYLE_ATTR)) return;
    const bg = el.tagName === 'TD' || el.tagName === 'TH' ? backgroundColorOf(el) : null;
    if (bg && !isNeutralCssColor(bg)) el.setAttribute('style', `background-color: ${bg}`);
    else el.removeAttribute('style');
  });

  root.querySelectorAll('o\\:p, apple-converted-space').forEach((el) => {
    const text = doc.createTextNode(el.textContent || ' ');
    el.replaceWith(text);
  });

  root.querySelectorAll('span').forEach((el) => {
    const cls = String(el.getAttribute('class') || '');
    if (/Apple-converted-space/i.test(cls) || /Apple-tab-span/i.test(cls)) {
      el.replaceWith(doc.createTextNode(el.textContent || ' '));
    }
  });

  // picture → keep inner img
  root.querySelectorAll('picture').forEach((pic) => {
    const img = pic.querySelector('img');
    if (img) pic.replaceWith(img);
  });

  const walk = [...root.querySelectorAll('*')];
  for (const el of walk) {
    if (ALLOWED_TAGS.has(el.tagName)) continue;
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name === 'href' && el.tagName === 'A') {
        if (!SAFE_HREF.test(attr.value.trim())) el.removeAttribute(attr.name);
        return;
      }
      if (name.startsWith('data-rv-')) return;
      if (name === 'src' && el.tagName === 'IMG') return;
      if (name === 'alt' && el.tagName === 'IMG') return;
      if (name === 'width' && (el.tagName === 'IMG' || el.tagName === 'TD' || el.tagName === 'TH')) return;
      if (name === 'colspan' || name === 'rowspan') return;
      if (name === 'style') return;
      if (name === 'href' || name.startsWith('on') || name === 'class' || name === 'id') {
        el.removeAttribute(attr.name);
      }
      if (name.startsWith('data-') || name.startsWith('aria-')) el.removeAttribute(attr.name);
    });
  });

  const divToParagraph = (div, fallbackHtml = '') => {
    const p = doc.createElement('p');
    p.innerHTML = div.innerHTML || fallbackHtml;
    if (div.hasAttribute(ALIGN_ATTR)) p.setAttribute(ALIGN_ATTR, div.getAttribute(ALIGN_ATTR));
    div.replaceWith(p);
  };

  root.querySelectorAll('div').forEach((div) => {
    if (div.querySelector('img')) {
      const hasBlock = div.querySelector('p,div,ul,ol,table,h1,h2,h3,h4,blockquote,pre');
      if (!hasBlock) divToParagraph(div);
      return;
    }

    const onlyBreak = div.childNodes.length === 1 && div.firstChild.nodeName === 'BR';
    if (onlyBreak || !div.textContent?.trim()) {
      divToParagraph(div, '<br>');
      return;
    }
    const hasBlock = div.querySelector('p,div,ul,ol,table,h1,h2,h3,h4,blockquote,pre');
    if (!hasBlock) divToParagraph(div);
  });

  root.querySelectorAll(`[${ALIGN_ATTR}]`).forEach((el) => {
    const align = el.getAttribute(ALIGN_ATTR);
    el.removeAttribute(ALIGN_ATTR);
    if (/^(P|H[1-6])$/.test(el.tagName)) el.setAttribute('style', `text-align: ${align}`);
  });
  root.querySelectorAll(`[${FLAT_STYLE_ATTR}]`).forEach((el) => el.removeAttribute(FLAT_STYLE_ATTR));

  return dedupeMirroredPasteHtml(root.innerHTML.trim() || '<p></p>');
}

/**
 * Map clipboard image files onto unusable <img> srcs (webkit-fake-url / empty),
 * and resolve blob: URLs to durable data: URLs so autosave keeps the pixels.
 */
export async function materializePastedHtmlImages(html, imageFiles = []) {
  if (typeof DOMParser === 'undefined') {
    return { html: String(html || ''), unusedFiles: imageFiles, droppedImages: 0 };
  }

  const doc = new DOMParser().parseFromString(
    `<div id="rv-paste-root">${String(html || '')}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-paste-root') || doc.body;
  const imgs = [...(root?.querySelectorAll('img') || [])];
  const fileQueue = [...imageFiles];
  const unusedFiles = [];
  let droppedImages = 0;

  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (/^data:/i.test(src)) continue;

    if (/^blob:/i.test(src)) {
      try {
        img.setAttribute('src', await blobUrlToDataUrl(src));
        continue;
      } catch {
        // fall through to file mapping
      }
    }

    if (isUnusableImageSrc(src) || /^blob:/i.test(src)) {
      const next = fileQueue.shift();
      if (next) {
        try {
          img.setAttribute('src', await fileToDataUrl(next));
        } catch {
          img.remove();
          droppedImages += 1;
        }
      } else {
        img.remove();
        droppedImages += 1;
      }
    }
  }

  unusedFiles.push(...fileQueue);

  await resolvePastedImageSizeHints(root);

  return { html: root?.innerHTML?.trim() || '<p></p>', unusedFiles, droppedImages };
}

const IMAGE_SIZE_PROBE_TIMEOUT_MS = 2500;

function loadNaturalImageSize(src) {
  if (typeof Image === 'undefined' || !src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const probe = new Image();
    const finish = (size) => {
      clearTimeout(timer);
      probe.onload = null;
      probe.onerror = null;
      resolve(size);
    };
    const timer = setTimeout(() => finish(null), IMAGE_SIZE_PROBE_TIMEOUT_MS);
    probe.onload = () =>
      finish(probe.naturalWidth && probe.naturalHeight ? { w: probe.naturalWidth, h: probe.naturalHeight } : null);
    probe.onerror = () => finish(null);
    probe.src = src;
  });
}

/** Web pages often size images by height / max-* only; turn that into the node's pixel width. */
async function resolvePastedImageSizeHints(root) {
  const hintAttrs = [PASTE_IMG_HEIGHT_ATTR, PASTE_IMG_MAX_W_ATTR, PASTE_IMG_MAX_H_ATTR];
  const imgs = [...(root?.querySelectorAll('img') || [])].filter((img) =>
    hintAttrs.some((a) => img.hasAttribute(a))
  );

  await Promise.all(
    imgs.map(async (img) => {
      const height = Number(img.getAttribute(PASTE_IMG_HEIGHT_ATTR)) || null;
      const maxW = Number(img.getAttribute(PASTE_IMG_MAX_W_ATTR)) || null;
      const maxH = Number(img.getAttribute(PASTE_IMG_MAX_H_ATTR)) || null;
      hintAttrs.forEach((a) => img.removeAttribute(a));
      if (img.getAttribute('width')) return;

      const natural = await loadNaturalImageSize(img.getAttribute('src'));
      if (!natural) return;
      const aspect = natural.w / natural.h;
      let width = height ? height * aspect : natural.w;
      if (maxW && width > maxW) width = maxW;
      if (maxH && width / aspect > maxH) width = maxH * aspect;
      width = Math.min(MAX_PASTED_IMAGE_WIDTH, Math.round(width));
      if (width > 0) img.setAttribute('width', String(width));
    })
  );
}

function imagesToHtml(dataUrls) {
  return dataUrls
    .filter(Boolean)
    .map((src) => `<p><img src="${src}"></p>`)
    .join('');
}

/**
 * Build HTML TipTap can insert from a paste event, plus how many images the
 * source had (`expectedImages`) vs how many made it in (`insertedImages`).
 * `html` is null when the paste should fall through to TipTap's default handler.
 */
export async function buildRecordVaultPasteResult(clipboardData) {
  const empty = { html: null, expectedImages: 0, insertedImages: 0 };
  if (!clipboardData) return empty;

  const htmlRaw = String(clipboardData.getData('text/html') || '');
  const plain = String(clipboardData.getData('text/plain') || '');
  const syncFiles = collectClipboardImageFiles(clipboardData);

  if (!htmlRaw && !plain && !syncFiles.length) return empty;

  const plainImageSlots = countObjectReplacementChars(plain);

  // Tiny plain-only paste (e.g. a few characters) — let TipTap handle it.
  if (!htmlRaw && !syncFiles.length && !plainImageSlots) {
    if (!plain || (plain.length < 8 && !/\n/.test(plain))) return empty;
  }

  let html = '';
  let unusedFiles = [];
  let placeholdersBefore = 0;
  let droppedImages = 0;

  if (htmlRaw) {
    const normalized = normalizePastedHtml(htmlRaw);
    placeholdersBefore = countUnmaterializedImages(normalized);
    const imageFiles = await resolveImageFilesForPaste(clipboardData, htmlRaw, normalized);
    const materialized = await materializePastedHtmlImages(normalized, imageFiles);
    html = materialized.html;
    unusedFiles = materialized.unusedFiles;
    droppedImages = materialized.droppedImages;
  } else if (plain) {
    const withSlots = objectReplacementCharsToImageSlots(plainTextToHtml(plain));
    placeholdersBefore = plainImageSlots;
    const imageFiles = await resolveImageFilesForPaste(clipboardData, '', withSlots);
    const materialized = await materializePastedHtmlImages(withSlots, imageFiles);
    html = materialized.html;
    unusedFiles = materialized.unusedFiles;
    droppedImages = materialized.droppedImages;
  } else {
    unusedFiles = await resolveImageFilesForPaste(clipboardData, htmlRaw, '');
  }

  if (unusedFiles.length) {
    const dataUrlCount = countDataUrlImages(html);
    // Images already embedded in HTML — do not append the same clipboard files again.
    if (dataUrlCount === 0) {
      const urls = [];
      for (const file of unusedFiles) {
        try {
          urls.push(await fileToDataUrl(file));
        } catch {
          // skip unreadable
        }
      }
      if (urls.length) {
        html = `${html || ''}${imagesToHtml(urls)}`;
      }
    }
  }

  let trimmed = String(html || '').trim();
  trimmed = dedupeMirroredPasteHtml(trimmed);
  if (!trimmed || trimmed === '<p></p>') return empty;

  const insertedImages = Math.max(0, placeholdersBefore - droppedImages);
  if (droppedImages > 0) {
    console.warn('[RecordVault paste] images not exposed to the browser clipboard', {
      expected: placeholdersBefore,
      inserted: insertedImages
    });
  }

  return {
    html: trimmed,
    expectedImages: placeholdersBefore,
    insertedImages,
    source: isEvernoteClipboardHtml(htmlRaw) ? 'evernote' : ''
  };
}

export async function buildRecordVaultPasteHtml(clipboardData) {
  const { html } = await buildRecordVaultPasteResult(clipboardData);
  return html;
}

export function recordVaultMissingPasteImagesMessage(missingCount, source = '') {
  const n = Math.max(1, Math.trunc(Number(missingCount) || 1));
  const noun = n === 1 ? 'image was' : 'images were';
  if (source === 'evernote') {
    return (
      `Text pasted, but Evernote keeps its pictures in its own private storage and never hands them to the browser when you copy, so ${n} ${noun} skipped.\n\n` +
      'To bring the whole note in WITH pictures:\n' +
      '1. In Evernote, open the note → ••• (More actions) → Export → ENEX (.enex) → Save.\n' +
      '2. Here: File → Import → Evernote (.enex) → pick that file.\n\n' +
      'Or for one picture: in Evernote right-click the image → Copy Image, then paste it here.'
    );
  }
  return (
    `Text pasted, but ${n} ${noun} not handed to the browser by the app you copied from, so ${n === 1 ? 'it was' : 'they were'} skipped.\n\n` +
    'To bring images in:\n' +
    '• Copy each image on its own (click the image → Ctrl/Cmd-C) and paste it here, or drag the image file onto the note.\n' +
    '• Or copy/paste the note using Safari, which passes Apple Notes images through more often than Chrome.'
  );
}

/**
 * True when we should take over paste (rich external content / images).
 */
export function shouldHandleRecordVaultPaste(clipboardData) {
  if (!clipboardData) return false;
  const html = String(clipboardData.getData('text/html') || '');
  const plain = String(clipboardData.getData('text/plain') || '');
  const files = collectClipboardImageFiles(clipboardData);
  if (files.length) return true;
  if (html) return true;
  if (countObjectReplacementChars(plain)) return true;
  if (plain.length >= 8 || /\n/.test(plain)) return true;
  return false;
}
