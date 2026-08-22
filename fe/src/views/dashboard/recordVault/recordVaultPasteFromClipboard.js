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

const UNUSABLE_IMG_SRC =
  /^(webkit-fake-url:|x-apple-|cid:|file:|about:|chrome-extension:)/i;

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

export function isUnusableImageSrc(src) {
  const s = String(src || '').trim();
  if (!s) return true;
  if (UNUSABLE_IMG_SRC.test(s)) return true;
  // Empty / placeholder Apple Notes media
  if (s === '#' || s.startsWith('#')) return true;
  return false;
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
    if (!/^data:/i.test(src)) count += 1;
  }
  return count;
}

async function resolveImageFilesForPaste(clipboardData, _htmlRaw, normalizedHtml) {
  let files = collectClipboardImageFiles(clipboardData);
  const placeholders = countUnmaterializedImages(normalizedHtml);

  const needsAsync = placeholders > 0 && placeholders > files.length;

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

/**
 * Strip Apple / Office junk and keep TipTap-friendly markup.
 */
export function normalizePastedHtml(html) {
  if (typeof DOMParser === 'undefined') {
    return unwrapAppleFragment(html);
  }

  const raw = unwrapAppleFragment(html);
  const doc = new DOMParser().parseFromString(
    `<div id="rv-paste-root">${raw}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-paste-root') || doc.body;
  if (!root) return plainTextToHtml('');

  root.querySelectorAll('script, style, meta, link, title, xml, head').forEach((el) => el.remove());

  root.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const keep = [];
    const color = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const bg = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);
    const fw = style.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i);
    const fs = style.match(/(?:^|;)\s*font-style\s*:\s*([^;]+)/i);
    const td = style.match(/(?:^|;)\s*text-decoration\s*:\s*([^;]+)/i);
    if (color) keep.push(`color:${color[1].trim()}`);
    if (bg) keep.push(`background-color:${bg[1].trim()}`);
    if (fw) keep.push(`font-weight:${fw[1].trim()}`);
    if (fs) keep.push(`font-style:${fs[1].trim()}`);
    if (td) keep.push(`text-decoration:${td[1].trim()}`);
    if (keep.length) el.setAttribute('style', keep.join(';'));
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
      if (name === 'href' && el.tagName === 'A') return;
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

  root.querySelectorAll('div').forEach((div) => {
    if (div.querySelector('img')) {
      const hasBlock = div.querySelector('p,div,ul,ol,table,h1,h2,h3,h4,blockquote,pre');
      if (!hasBlock) {
        const p = doc.createElement('p');
        p.innerHTML = div.innerHTML;
        div.replaceWith(p);
      }
      return;
    }

    const onlyBreak = div.childNodes.length === 1 && div.firstChild.nodeName === 'BR';
    if (onlyBreak || !div.textContent?.trim()) {
      const p = doc.createElement('p');
      p.innerHTML = div.innerHTML || '<br>';
      div.replaceWith(p);
      return;
    }
    const hasBlock = div.querySelector('p,div,ul,ol,table,h1,h2,h3,h4,blockquote,pre');
    if (!hasBlock) {
      const p = doc.createElement('p');
      p.innerHTML = div.innerHTML;
      div.replaceWith(p);
    }
  });

  return dedupeMirroredPasteHtml(root.innerHTML.trim() || '<p></p>');
}

/**
 * Map clipboard image files onto unusable <img> srcs (webkit-fake-url / empty),
 * and resolve blob: URLs to durable data: URLs so autosave keeps the pixels.
 */
export async function materializePastedHtmlImages(html, imageFiles = []) {
  if (typeof DOMParser === 'undefined') return { html: String(html || ''), unusedFiles: imageFiles };

  const doc = new DOMParser().parseFromString(
    `<div id="rv-paste-root">${String(html || '')}</div>`,
    'text/html'
  );
  const root = doc.getElementById('rv-paste-root') || doc.body;
  const imgs = [...(root?.querySelectorAll('img') || [])];
  const fileQueue = [...imageFiles];
  const unusedFiles = [];

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
        }
      } else {
        img.remove();
      }
    }
  }

  unusedFiles.push(...fileQueue);

  return { html: root?.innerHTML?.trim() || '<p></p>', unusedFiles };
}

function imagesToHtml(dataUrls) {
  return dataUrls
    .filter(Boolean)
    .map((src) => `<p><img src="${src}"></p>`)
    .join('');
}

/**
 * Build HTML TipTap can insert from a paste event.
 * Returns null when the paste should fall through to TipTap's default handler.
 */
export async function buildRecordVaultPasteHtml(clipboardData) {
  if (!clipboardData) return null;

  const htmlRaw = String(clipboardData.getData('text/html') || '');
  const plain = String(clipboardData.getData('text/plain') || '');
  const syncFiles = collectClipboardImageFiles(clipboardData);

  if (!htmlRaw && !plain && !syncFiles.length) return null;

  // Tiny plain-only paste (e.g. a few characters) — let TipTap handle it.
  if (!htmlRaw && !syncFiles.length && !htmlHintsImages(htmlRaw)) {
    if (!plain || (plain.length < 8 && !/\n/.test(plain))) return null;
  }

  let html = '';
  let unusedFiles = [];
  let placeholdersBefore = 0;

  if (htmlRaw) {
    const normalized = normalizePastedHtml(htmlRaw);
    placeholdersBefore = countUnmaterializedImages(normalized);
    const imageFiles = await resolveImageFilesForPaste(clipboardData, htmlRaw, normalized);
    const materialized = await materializePastedHtmlImages(normalized, imageFiles);
    html = materialized.html;
    unusedFiles = materialized.unusedFiles;
  } else if (plain) {
    html = plainTextToHtml(plain);
    unusedFiles = await resolveImageFilesForPaste(clipboardData, '', '');
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
  if (!trimmed || trimmed === '<p></p>') return null;

  if (htmlRaw && placeholdersBefore > 0 && !/<img\b/i.test(trimmed)) {
    console.warn(
      '[RecordVault paste] Apple Notes images were not exposed to the browser clipboard. ' +
        'Try pasting again, or copy fewer images at once.'
    );
  }

  return trimmed;
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
  if (htmlHintsImages(html)) return true;
  if (plain.length >= 8 || /\n/.test(plain)) return true;
  return false;
}
