/**
 * Evernote export (.enex) → TutaNotes note body HTML.
 *
 * Copy/paste out of the Evernote app only carries `en-cache://` image references
 * (bytes stay in Evernote's private cache), so the export file is the only way a
 * browser can get the pictures. ENEX = XML with one <note> per note: ENML in
 * <content>, and each attachment as base64 in <resource>, referenced from
 * <en-media hash="md5-of-bytes">.
 */
import { md5 } from 'hash-wasm';

const MAX_INLINE_TEXT_ATTACHMENT_BYTES = 256 * 1024;
const TEXT_LIKE_MIME = /^(text\/|application\/(json|xml|javascript|x-sh|x-yaml|yaml|toml))/i;

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Newlines as character references so the block has no blank source lines —
 * note setContent goes through markdown-it, which ends an HTML block at a blank line.
 */
function escapePreText(text) {
  return escapeHtml(String(text ?? '').replace(/\r\n?/g, '\n')).replace(/\n/g, '&#10;');
}

function childText(el, tagName) {
  return String(el?.getElementsByTagName(tagName)?.[0]?.textContent ?? '').trim();
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function readResources(noteEl) {
  const out = [];
  for (const res of [...noteEl.getElementsByTagName('resource')]) {
    const base64 = childText(res, 'data').replace(/\s+/g, '');
    if (!base64) continue;
    let bytes;
    try {
      bytes = base64ToBytes(base64);
    } catch {
      continue;
    }
    const mime = childText(res, 'mime') || 'application/octet-stream';
    out.push({
      mime,
      base64,
      bytes,
      hash: (await md5(bytes)).toLowerCase(),
      fileName: childText(res, 'file-name') || '',
      used: false
    });
  }
  return out;
}

const PRE_SLOT_ATTR = 'data-rv-enex-pre';

function mediaHtml(resource, mediaEl, stats, preBlocks) {
  if (!resource) {
    stats.missing += 1;
    return '';
  }
  const label = escapeHtml(resource.fileName || resource.mime);

  if (/^image\//i.test(resource.mime)) {
    stats.images += 1;
    const width = parseInt(mediaEl.getAttribute('width') || '', 10);
    const widthAttr = Number.isFinite(width) && width > 0 ? ` width="${width}"` : '';
    return `<img src="data:${resource.mime};base64,${resource.base64}" alt="${label}"${widthAttr}>`;
  }

  stats.attachments += 1;
  if (TEXT_LIKE_MIME.test(resource.mime) && resource.bytes.length <= MAX_INLINE_TEXT_ATTACHMENT_BYTES) {
    preBlocks.push(escapePreText(new TextDecoder('utf-8').decode(resource.bytes)));
    return `<p><strong>Attachment: ${label}</strong></p><pre ${PRE_SLOT_ATTR}="${preBlocks.length - 1}"></pre>`;
  }
  stats.skippedAttachments += 1;
  return `<p>Attachment: ${label} (not imported)</p>`;
}

/** ENML <en-note> markup → editor HTML, resolving <en-media> against the note's resources. */
async function enmlToHtml(enml, resources, stats) {
  // ENML is XHTML: self-closing custom tags would swallow their siblings in the HTML parser.
  const source = String(enml || '').replace(/<(en-media|en-todo|en-crypt)\b([^>]*?)\/>/gi, '<$1$2></$1>');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const note = doc.querySelector('en-note') || doc.body;

  // Text attachment bodies are spliced in after serialization; innerHTML would turn
  // their &#10; back into raw blank lines.
  const preBlocks = [];
  const byHash = new Map(resources.map((r) => [r.hash, r]));
  const medias = [...note.querySelectorAll('en-media')];
  for (const mediaEl of medias) {
    const hash = String(mediaEl.getAttribute('hash') || '').toLowerCase();
    let resource = byHash.get(hash);
    if (!resource || resource.used) resource = resources.find((r) => !r.used);
    if (resource) resource.used = true;
    const holder = doc.createElement('div');
    holder.innerHTML = mediaHtml(resource, mediaEl, stats, preBlocks);
    mediaEl.replaceWith(...holder.childNodes);
  }

  note.querySelectorAll('en-todo').forEach((todo) => {
    const checked = String(todo.getAttribute('checked') || '').toLowerCase() === 'true';
    todo.replaceWith(doc.createTextNode(checked ? '☑ ' : '☐ '));
  });

  note.querySelectorAll('en-crypt').forEach((crypt) => {
    stats.encrypted += 1;
    const p = doc.createElement('p');
    p.textContent = '[Encrypted Evernote text — decrypt it in Evernote, then export again]';
    crypt.replaceWith(p);
  });

  note.querySelectorAll('script, style').forEach((el) => el.remove());

  // Attachments Evernote listed but never placed in the body.
  const leftovers = resources.filter((r) => !r.used);
  const tail = leftovers.map((r) => mediaHtml(r, doc.createElement('en-media'), stats, preBlocks)).join('');

  const collapsed = `${note.innerHTML}${tail}`.replace(/>\s*\n\s*</g, '><').replace(/\n\s*\n/g, '\n');
  return collapsed.replace(
    new RegExp(`<pre ${PRE_SLOT_ATTR}="(\\d+)"></pre>`, 'g'),
    (_m, idx) => `<pre><code>${preBlocks[Number(idx)] ?? ''}</code></pre>`
  );
}

export function emptyEnexStats() {
  return { notes: 0, images: 0, attachments: 0, skippedAttachments: 0, missing: 0, encrypted: 0 };
}

/**
 * Split an .enex export (one note or a whole notebook) into notes. Each note's body
 * is converted on demand via `toHtml(stats)` so a large notebook export isn't
 * decoded into memory all at once. Bodies are final fragments with no blank source
 * lines — do not re-parse them (that would restore raw newlines inside <pre>).
 */
export function readEnexNotes(enexText) {
  const xml = new DOMParser().parseFromString(String(enexText || ''), 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) {
    throw new Error('This file is not a valid Evernote export (.enex).');
  }
  const noteEls = [...xml.getElementsByTagName('note')];
  if (!noteEls.length) throw new Error('No notes found in this Evernote export.');

  return noteEls.map((noteEl) => ({
    title: childText(noteEl, 'title'),
    toHtml: async (stats) => {
      stats.notes += 1;
      const resources = await readResources(noteEl);
      return enmlToHtml(childText(noteEl, 'content'), resources, stats);
    }
  }));
}

/** Whole export → one note body; multiple notes are stacked, each under its title. */
export async function convertEnexToHtml(enexText) {
  const notes = readEnexNotes(enexText);
  const stats = emptyEnexStats();
  const parts = [];
  for (const note of notes) {
    const body = await note.toHtml(stats);
    parts.push(notes.length > 1 && note.title ? `<h2>${escapeHtml(note.title)}</h2>${body}` : body);
  }

  return {
    html: parts.join('<hr>') || '<p></p>',
    title: notes.length === 1 ? notes[0].title : '',
    stats
  };
}

export function enexImportSummaryMessage(stats) {
  const lines = [];
  if (stats.skippedAttachments) {
    lines.push(`${stats.skippedAttachments} non-text attachment(s) (PDF, etc.) were listed by name but not imported.`);
  }
  if (stats.missing) lines.push(`${stats.missing} image(s) were missing from the export file.`);
  if (stats.encrypted) lines.push(`${stats.encrypted} encrypted section(s) must be decrypted in Evernote first.`);
  return lines.join('\n\n');
}
