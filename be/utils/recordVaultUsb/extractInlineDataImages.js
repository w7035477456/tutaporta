/**
 * Pull `data:image/…;base64,…` out of note HTML into vault files.
 * Replaces each inline image with `<img data-file-id="{attachmentId}">` (pointer only).
 * Bytes go under TutaNotes/files/{notebook}/{note}/{id}.{ext} via the attachments table.
 */

const DATA_IMAGE_SRC_RE =
  /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+))\2([^>]*>)/gi;

const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';
const NOTE_BODY_V2_PREFIX = '\u2063RV2';

const EXT_BY_MIME = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
  bmp: 'bmp',
  'svg+xml': 'svg',
  heic: 'heic',
  heif: 'heif'
};

export function bodyHasInlineDataImage(bodyText) {
  const raw = String(bodyText ?? '');
  if (!raw || raw.startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX)) return false;
  return /src\s*=\s*["']data:image\//i.test(raw);
}

export function mimeSubtypeToExt(subtype) {
  const key = String(subtype || '')
    .trim()
    .toLowerCase()
    .split(';')[0];
  return EXT_BY_MIME[key] || (key && /^[a-z0-9]+$/i.test(key) ? key : 'bin');
}

/**
 * Decode one data-URL image. Returns null if invalid.
 * @returns {{ buffer: Buffer, ext: string, mimeType: string } | null}
 */
export function decodeDataImageUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const m = /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw.trim());
  if (!m) return null;
  const subtype = m[1];
  const b64 = m[2].replace(/\s+/g, '');
  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (!buffer?.length) return null;
  const ext = mimeSubtypeToExt(subtype);
  return { buffer, ext, mimeType: `image/${subtype.split(';')[0].toLowerCase()}` };
}

/**
 * Replace every inline data:image src with a caller-supplied pointer builder.
 * @param {string} html
 * @param {(decoded: { buffer: Buffer, ext: string, mimeType: string }, matchIndex: number) =>
 *   Promise<{ fileId: number } | null> | { fileId: number } | null} saveImage
 */
export async function rewriteInlineDataImages(html, saveImage) {
  const input = String(html ?? '');
  if (!input || input.startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX)) {
    return { html: input, extracted: 0, failed: 0 };
  }
  // Skip opaque v2 segment bodies — extract only plain HTML notes.
  if (input.startsWith(NOTE_BODY_V2_PREFIX)) {
    return { html: input, extracted: 0, failed: 0 };
  }

  const matches = [...input.matchAll(DATA_IMAGE_SRC_RE)];
  if (!matches.length) {
    return { html: input, extracted: 0, failed: 0 };
  }

  let extracted = 0;
  let failed = 0;
  let out = '';
  let last = 0;

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = match.index ?? 0;
    out += input.slice(last, start);
    last = start + match[0].length;

    const dataUrl = match[3];
    const decoded = decodeDataImageUrl(dataUrl);
    if (!decoded) {
      failed += 1;
      out += match[0];
      continue;
    }

    let saved = null;
    try {
      saved = await saveImage(decoded, i);
    } catch {
      saved = null;
    }
    const fileId = Number(saved?.fileId);
    if (!Number.isFinite(fileId) || fileId < 1) {
      failed += 1;
      out += match[0];
      continue;
    }

    extracted += 1;
    // Pointer only — no src bytes. FE resolves data-file-id → attachment URL.
    const fullTag = match[0];
    let tag = fullTag
      .replace(/\s*src\s*=\s*(["'])data:image\/[^"']*\1/i, '')
      .replace(/\s*data-file-id\s*=\s*(["'])[^"']*\1/gi, '')
      .replace(/\s*data-attachment-id\s*=\s*(["'])[^"']*\1/gi, '');
    tag = tag.replace(/^<img\b/i, `<img data-file-id="${fileId}"`);
    out += tag;
  }

  out += input.slice(last);
  return { html: out, extracted, failed };
}
