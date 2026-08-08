import { useState } from 'react';
import PropTypes from 'prop-types';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { themedAlert, themedConfirm, themedPrompt } from 'utils/themedDialog';

/**
 * "File" dropdown for the Record Vault editor toolbar.
 *
 * Wires Import / Export for the currently open note using the TipTap editor's
 * imperative ref (exposed by PhotoAlbumsNoteEditor):
 *   - Export → Markdown (.md) / HTML (.html) / PDF (.pdf)
 *   - Import → Markdown (.md / Joplin folder + photos) / HTML (.html) / PDF (.pdf)
 *
 * PDF export: direct one-click .pdf download (isolated iframe → html2canvas →
 * jsPDF), with a native print → "Save as PDF" fallback for notes too large for
 * a single canvas. PDF import: pdf.js text extraction → HTML paragraphs (scanned
 * image-only PDFs have no text layer and import as an empty note with a notice).
 * Markdown import accepts a Joplin export folder so `_resources` photos are
 * embedded as data URLs (single .md file still works for text-only notes).
 * Front matter (`MD - Markdown + Front Matter`) is stripped; title is applied
 * when present. Markdown uses tiptap-markdown (lossless HTML fallback).
 *
 * All conversion/download/print work is self-contained here; the parent only
 * supplies content getters, importers, the note title (for filenames), and
 * whether a note is currently open + unlocked (`ready`).
 */

// This app sets -webkit-text-fill-color: #fff globally on buttons/labels, which
// overrides `color`. Force both so the menu text is truly black.
const MENU_TEXT_SX = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important'
};

// Match the yellow toolbar buttons: black bold text on a yellow panel.
const MENU_PAPER_SX = {
  bgcolor: 'var(--theme-yellow-color)',
  color: '#000',
  border: '3px solid #000',
  borderRadius: 1,
  '& .MuiList-root': { py: 0.5 }
};

const MENU_ITEM_SX = {
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.14)' },
  '&.Mui-focusVisible': { bgcolor: 'rgba(0, 0, 0, 0.14)' },
  '&.Mui-disabled': { color: '#000 !important', WebkitTextFillColor: '#000 !important', opacity: 0.4 },
  '& .MuiListItemText-primary': { color: '#000 !important', WebkitTextFillColor: '#000 !important' }
};

function sanitizeFileName(title) {
  const base = String(title || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-') // illegal filename chars
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return base || 'note';
}

function downloadBlob(fileName, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Wrap the editor's body HTML in a standalone, printable HTML document. */
export function buildHtmlDocument(title, bodyHtml) {
  const safeTitle = String(title || 'Note').replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #111; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
  table td, table th { border: 1px solid #999; padding: 4px 8px; }
  pre { background: #f4f4f4; padding: 12px; overflow: auto; border-radius: 6px; }
  code { font-family: "Courier New", monospace; }
  blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
</style>
</head>
<body>
${bodyHtml || '<p></p>'}
</body>
</html>`;
}

export function sanitizePhotoAlbumsExportFileName(title) {
  return sanitizeFileName(title);
}

/**
 * Build the quick-view / print document: the fully rendered note plus a small
 * (screen-only) toolbar with a "Save as PDF" button. The browser's native print
 * engine handles any length, keeps text selectable, and "Save as PDF" is the
 * standard, reliable way to produce the file (html2canvas gave blank output).
 */
function buildPdfPreviewDocument(title, bodyHtml) {
  const safeTitle = String(title || 'Note').replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  html, body { margin: 0; }
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; color: #111; background: #f2f2f2; }
  .rv-print-toolbar {
    position: sticky; top: 0; display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: #202020; color: #fff; z-index: 10;
  }
  .rv-print-toolbar button {
    font: inherit; font-weight: 700; cursor: pointer; border: 0; border-radius: 6px;
    padding: 8px 16px; background: #ffd400; color: #000;
  }
  .rv-print-toolbar .rv-hint { font-size: 13px; opacity: 0.85; }
  .rv-page {
    max-width: 800px; margin: 16px auto; padding: 32px; background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  }
  .rv-page img { max-width: 100%; height: auto; }
  .rv-page table { border-collapse: collapse; }
  .rv-page td, .rv-page th { border: 1px solid #999; padding: 4px 8px; }
  .rv-page pre { background: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  .rv-page code { font-family: "Courier New", monospace; }
  .rv-page blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
  @media print {
    body { background: #fff; }
    .rv-print-toolbar { display: none !important; }
    .rv-page { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="rv-print-toolbar">
  <button type="button" onclick="window.print()">Save as PDF</button>
  <span class="rv-hint">Choose “Save as PDF” as the destination in the print dialog.</span>
</div>
<div class="rv-page">
${bodyHtml || '<p></p>'}
</div>
</body>
</html>`;
}

const PDF_RENDER_WIDTH_PX = 800;
// Browsers cap canvas dimensions (~16k px); a single render taller than this
// comes back blank, so above it we fall back to the native print flow.
const PDF_MAX_CANVAS_PX = 15000;

/** Clean, isolated document used as the html2canvas render source (no app CSS). */
function buildPdfRenderDocument(title, bodyHtml) {
  const safeTitle = String(title || 'Note').replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  html { margin: 0; }
  body { margin: 0; padding: 32px; width: ${PDF_RENDER_WIDTH_PX}px; box-sizing: border-box; font-family: Georgia, "Times New Roman", serif; line-height: 1.5; color: #111; background: #fff; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #999; padding: 4px 8px; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  code { font-family: "Courier New", monospace; }
  blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
</style>
</head>
<body>${bodyHtml || '<p></p>'}</body>
</html>`;
}

/** Wait for an iframe document to finish loading its images and fonts. */
function waitForIframeReady(iframe) {
  return new Promise((resolve) => {
    const idoc = iframe.contentDocument;
    const finish = async () => {
      try {
        if (idoc.fonts?.ready) await idoc.fonts.ready;
      } catch {
        /* ignore font readiness errors */
      }
      const imgs = Array.from(idoc.images || []);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? null
            : new Promise((res) => {
                img.onload = res;
                img.onerror = res;
              })
        )
      );
      setTimeout(resolve, 120);
    };
    if (idoc.readyState === 'complete') finish();
    else iframe.addEventListener('load', finish);
  });
}

/**
 * Directly download the note as a .pdf (no print dialog). Renders the note in an
 * isolated hidden iframe — clean CSS, so text is never white/blank — to a single
 * canvas, slices that canvas into A4 pages, and saves via jsPDF. Throws if the
 * note is too tall for one canvas so the caller can fall back to native print.
 */
async function savePdfDirect(title, bodyHtml) {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasMod.default || html2canvasMod;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed; right:0; bottom:0; width:${PDF_RENDER_WIDTH_PX}px; height:1200px; border:0; visibility:hidden; z-index:-1;`;
  document.body.appendChild(iframe);
  try {
    const idoc = iframe.contentDocument || iframe.contentWindow.document;
    idoc.open();
    idoc.write(buildPdfRenderDocument(title, bodyHtml));
    idoc.close();
    await waitForIframeReady(iframe);

    const root = idoc.body;
    const totalHeight = Math.max(root.scrollHeight, root.offsetHeight);
    iframe.style.height = `${totalHeight}px`;

    // Highest scale that keeps the single canvas within the browser's limit.
    let scale = 2;
    if (totalHeight * scale > PDF_MAX_CANVAS_PX) scale = 1;
    if (totalHeight * scale > PDF_MAX_CANVAS_PX) {
      throw new Error('note-too-long-for-canvas');
    }

    const fullCanvas = await html2canvas(root, {
      scale,
      width: PDF_RENDER_WIDTH_PX,
      height: totalHeight,
      windowWidth: PDF_RENDER_WIDTH_PX,
      windowHeight: totalHeight,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });
    if (!fullCanvas.width || !fullCanvas.height) throw new Error('empty-canvas');

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWmm = 210;
    const pxPerMm = fullCanvas.width / pageWmm;
    const pageSlicePx = Math.floor(297 * pxPerMm);

    let offset = 0;
    let page = 0;
    while (offset < fullCanvas.height) {
      const sliceH = Math.min(pageSlicePx, fullCanvas.height - offset);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = fullCanvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(fullCanvas, 0, offset, fullCanvas.width, sliceH, 0, 0, fullCanvas.width, sliceH);
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
      if (page > 0) doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, 0, pageWmm, sliceH / pxPerMm);
      offset += sliceH;
      page += 1;
    }
    doc.save(`${sanitizeFileName(title)}.pdf`);
  } finally {
    iframe.remove();
  }
}

/**
 * Fallback: open a quick-view popup with the rendered note and auto-open the
 * print dialog so the user can "Save as PDF" (any length, selectable text).
 */
async function printPreview(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) {
    await themedAlert('Please allow pop-ups for this site to export the note as PDF.');
    return;
  }
  win.document.open();
  win.document.write(buildPdfPreviewDocument(title, bodyHtml));
  win.document.close();
  win.focus();
  const triggerPrint = () =>
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* the "Save as PDF" button in the quick view still works */
      }
    }, 500);
  if (win.document.readyState === 'complete') triggerPrint();
  else win.addEventListener('load', triggerPrint);
}

/**
 * Export the note as PDF. Tries a direct one-click download first; if the note is
 * too large for a single canvas (or rendering fails), falls back to the native
 * print → "Save as PDF" quick view.
 */
function exportPdf(title, bodyHtml) {
  savePdfDirect(title, bodyHtml).catch(() => void printPreview(title, bodyHtml));
}

/**
 * Normalize an imported HTML file into a single-line body fragment.
 *
 * tiptap-markdown routes setContent through markdown-it (html: true). markdown-it
 * only passes an HTML block through verbatim while it has no blank lines, so we
 * strip the document down to <body> and collapse whitespace between tags to keep
 * the import lossless (otherwise stray text/blank lines get re-parsed as markdown).
 */
export function prepareImportedHtml(raw) {
  try {
    const doc = new DOMParser().parseFromString(String(raw ?? ''), 'text/html');
    const html = doc?.body ? doc.body.innerHTML : String(raw ?? '');
    const collapsed = html.replace(/>\s*\n\s*</g, '><').trim();
    return collapsed || '<p></p>';
  } catch {
    return String(raw ?? '') || '<p></p>';
  }
}

/** Prompt for a single file and resolve its text contents (or null if cancelled). */
function pickTextFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    // If the dialog is dismissed we simply never fire onchange; that's fine.
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Folder picker (Joplin MD export root / notebook folder). Returns File[] with
 * webkitRelativePath set, or null if cancelled.
 */
function pickDirectoryFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    // Chromium / Safari / Edge — required to read .md + sibling _resources/.
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(files.length ? files : null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function normalizeRelPath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function dirnamePath(relPath) {
  const parts = normalizeRelPath(relPath).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function basenamePath(relPath) {
  const parts = normalizeRelPath(relPath).split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/** Resolve `../_resources/foo.png` relative to the note file's directory. */
function resolveRelativePath(fromDir, relUrl) {
  const cleaned = String(relUrl || '')
    .trim()
    .replace(/^<|>$/g, '')
    .split('?')[0]
    .split('#')[0];
  if (!cleaned) return null;
  if (/^(https?:|data:|blob:)/i.test(cleaned)) return null;
  // Joplin in-app resource ids are not files on disk after a normal MD export.
  if (cleaned.startsWith(':/')) return null;
  if (cleaned.startsWith('/')) return cleaned.replace(/^\/+/, '');

  const stack = fromDir ? normalizeRelPath(fromDir).split('/').filter(Boolean) : [];
  for (const part of normalizeRelPath(cleaned).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i;

function isLikelyImageFile(file, pathHint = '') {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return IMAGE_FILE_RE.test(pathHint || file?.name || '');
}

/**
 * Strip Joplin / Obsidian YAML front matter. Returns body + optional title.
 */
export function stripYamlFrontMatter(markdown) {
  const raw = String(markdown ?? '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: raw, title: null };
  const yaml = match[1];
  const titleLine = yaml.match(/^title:\s*(.*)$/m);
  let title = titleLine ? String(titleLine[1] || '').trim() : null;
  if (title) {
    if (
      (title.startsWith('"') && title.endsWith('"')) ||
      (title.startsWith("'") && title.endsWith("'"))
    ) {
      title = title.slice(1, -1);
    }
    title = title.trim() || null;
  }
  return { body: raw.slice(match[0].length), title };
}

/** Collect markdown/HTML local image targets from note body. */
function collectLocalImageRefs(markdown) {
  const refs = new Set();
  const body = String(markdown ?? '');
  const mdImg = /!\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*(?:["'][^"']*["'])?\s*\)/g;
  const htmlImg = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = mdImg.exec(body))) {
    if (m[1]) refs.add(m[1].trim());
  }
  while ((m = htmlImg.exec(body))) {
    if (m[1]) refs.add(m[1].trim());
  }
  return [...refs];
}

/**
 * Rewrite local image paths in markdown/HTML to data URLs using a path→dataUrl map.
 */
function rewriteMarkdownImageRefs(markdown, dataUrlByPath, dataUrlByBasename) {
  let out = String(markdown ?? '');
  const replaceUrl = (url) => {
    const key = normalizeRelPath(url);
    if (dataUrlByPath.has(key)) return dataUrlByPath.get(key);
    const base = basenamePath(key);
    if (base && dataUrlByBasename.has(base.toLowerCase())) {
      return dataUrlByBasename.get(base.toLowerCase());
    }
    return null;
  };

  out = out.replace(/!\[([^\]]*)]\(\s*<?([^)\s>]+)>?\s*(?:["'][^"']*["'])?\s*\)/g, (full, alt, url) => {
    const dataUrl = replaceUrl(url);
    if (!dataUrl) return full;
    return `![${alt}](${dataUrl})`;
  });
  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi, (full, pre, url, post) => {
    const dataUrl = replaceUrl(url);
    if (!dataUrl) return full;
    return `${pre}${dataUrl}${post}`;
  });
  return out;
}

/**
 * Build an import payload from a Joplin-style folder (or any folder of .md + images).
 * Embeds photos as data URLs so TipTap can show them without the original paths.
 */
async function importMarkdownFromDirectoryFiles(files) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return null;

  const byRelPath = new Map();
  for (const file of list) {
    const rel = normalizeRelPath(file.webkitRelativePath || file.name);
    if (rel) byRelPath.set(rel, file);
  }

  const mdEntries = [...byRelPath.entries()].filter(([path]) => /\.(md|markdown|txt)$/i.test(path));
  if (!mdEntries.length) {
    throw new Error('No Markdown (.md) file found in that folder.');
  }

  let chosenPath;
  let chosenFile;
  if (mdEntries.length === 1) {
    [chosenPath, chosenFile] = mdEntries[0];
  } else {
    const sorted = mdEntries
      .map(([path, file]) => ({ path, file, depth: path.split('/').length }))
      .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
    const lines = sorted.map((entry, i) => `${i + 1}. ${entry.path}`).join('\n');
    const answer = await themedPrompt(
      `Multiple Markdown notes found. Enter the number to import into this note:\n\n${lines}`,
      '1'
    );
    if (answer == null) return null;
    const index = Number(String(answer).trim());
    if (!Number.isFinite(index) || index < 1 || index > sorted.length) {
      throw new Error('Invalid note number.');
    }
    chosenPath = sorted[index - 1].path;
    chosenFile = sorted[index - 1].file;
  }

  const raw = await readFileAsText(chosenFile);
  const { body, title } = stripYamlFrontMatter(raw);
  const noteDir = dirnamePath(chosenPath);
  const refs = collectLocalImageRefs(body);

  const dataUrlByPath = new Map();
  const dataUrlByBasename = new Map();
  let embedded = 0;
  let missing = 0;

  for (const ref of refs) {
    if (/^(https?:|data:|blob:)/i.test(ref) || ref.startsWith(':/')) continue;
    const resolved = resolveRelativePath(noteDir, ref);
    if (!resolved) continue;
    let file = byRelPath.get(resolved);
    if (!file) {
      // Case-insensitive path match (macOS exports).
      const lower = resolved.toLowerCase();
      for (const [path, f] of byRelPath) {
        if (path.toLowerCase() === lower) {
          file = f;
          break;
        }
      }
    }
    if (!file) {
      const base = basenamePath(resolved).toLowerCase();
      for (const [path, f] of byRelPath) {
        if (basenamePath(path).toLowerCase() === base && isLikelyImageFile(f, path)) {
          file = f;
          break;
        }
      }
    }
    if (!file || !isLikelyImageFile(file, resolved)) {
      missing += 1;
      continue;
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (!dataUrl) {
      missing += 1;
      continue;
    }
    dataUrlByPath.set(normalizeRelPath(ref), dataUrl);
    dataUrlByPath.set(resolved, dataUrl);
    dataUrlByBasename.set(basenamePath(resolved).toLowerCase(), dataUrl);
    embedded += 1;
  }

  const markdown = rewriteMarkdownImageRefs(body, dataUrlByPath, dataUrlByBasename);
  return {
    markdown,
    title,
    embedded,
    missing,
    sourcePath: chosenPath
  };
}

/**
 * Joplin / folder Markdown import. Prefer selecting the export folder so
 * `_resources` photos can be embedded. Falls back to a single .md (text only).
 */
async function pickMarkdownImportWithPhotos() {
  const useFolder = await themedConfirm(
    'Import Markdown with photos (Joplin):\n\nOK = choose the export FOLDER (contains .md and _resources)\nCancel = choose a single .md file (photos will be skipped)'
  );
  if (useFolder) {
    const files = await pickDirectoryFiles();
    if (!files) return null;
    return importMarkdownFromDirectoryFiles(files);
  }
  const text = await pickTextFile('.md,.markdown,.txt,text/markdown,text/plain');
  if (text == null) return null;
  const { body, title } = stripYamlFrontMatter(text);
  const localRefs = collectLocalImageRefs(body).filter(
    (ref) => !/^(https?:|data:|blob:)/i.test(ref) && !ref.startsWith(':/')
  );
  if (localRefs.length) {
    await themedAlert(
      'This Markdown references local photo files (for example Joplin _resources). Re-import and choose the export FOLDER so photos can be included.'
    );
  }
  return { markdown: body, title, embedded: 0, missing: localRefs.length, sourcePath: null };
}

/** Prompt for a PDF and resolve its ArrayBuffer (or null if cancelled). */
function pickPdfFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    };
    document.body.appendChild(input);
    input.click();
  });
}

function escapeHtmlText(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Turn pdf.js text items for one page into plain lines (grouped by Y position).
 * Image-only / scanned pages yield an empty string.
 */
function pdfTextItemsToLines(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const lines = [];
  let currentY = null;
  let current = '';
  for (const item of items) {
    const str = String(item?.str ?? '');
    const transform = item?.transform;
    const y = Array.isArray(transform) && Number.isFinite(Number(transform[5])) ? Number(transform[5]) : null;
    if (item?.hasEOL) {
      current += str;
      lines.push(current);
      current = '';
      currentY = null;
      continue;
    }
    if (y != null && currentY != null && Math.abs(y - currentY) > 2) {
      lines.push(current);
      current = str;
      currentY = y;
      continue;
    }
    if (current && str && !/\s$/.test(current) && !/^\s/.test(str)) current += ' ';
    current += str;
    if (y != null) currentY = y;
  }
  if (current) lines.push(current);
  return lines.map((line) => line.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trimEnd());
}

/** Convert extracted PDF lines into TipTap-friendly HTML paragraphs. */
function pdfLinesToHtml(allLines) {
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ').replace(/\s+/g, ' ').trim();
    para = [];
    if (text) blocks.push(`<p>${escapeHtmlText(text)}</p>`);
  };
  for (const raw of allLines) {
    const line = String(raw ?? '').trim();
    if (!line) {
      flushPara();
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks.length ? blocks.join('') : '';
}

/**
 * Extract selectable text from a PDF ArrayBuffer into an HTML body fragment.
 * Uses pdf.js (dynamic import). Throws on unreadable/corrupt files.
 */
export async function pdfArrayBufferToHtml(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const allLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageLines = pdfTextItemsToLines(content?.items);
    if (pageLines.length) {
      if (allLines.length) allLines.push(''); // blank line between pages
      allLines.push(...pageLines);
    }
  }
  const html = pdfLinesToHtml(allLines);
  if (!html) {
    return '<p><em>This PDF had no extractable text (it may be a scanned image). Paste or type content manually, or attach the PDF as a vault file.</em></p>';
  }
  return html;
}

export default function PhotoAlbumsFileMenu({
  disabled = false,
  ready = false,
  noteTitle = '',
  getHtml,
  getMarkdown,
  onImportHtml,
  onImportMarkdown,
  paymentActive = false,
  onSelectPayment,
  onSelectNotes,
  buttonSx,
  onBeforeOpen
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [importAnchor, setImportAnchor] = useState(null);
  const [exportAnchor, setExportAnchor] = useState(null);

  const open = Boolean(menuAnchor);

  const closeAll = () => {
    setImportAnchor(null);
    setExportAnchor(null);
    setMenuAnchor(null);
  };

  const handleExportMarkdown = () => {
    closeAll();
    const md = getMarkdown?.() ?? '';
    downloadBlob(`${sanitizeFileName(noteTitle)}.md`, 'text/markdown;charset=utf-8', md);
  };

  const handleExportHtml = () => {
    closeAll();
    const html = buildHtmlDocument(noteTitle, getHtml?.() ?? '');
    downloadBlob(`${sanitizeFileName(noteTitle)}.html`, 'text/html;charset=utf-8', html);
  };

  const handleExportPdf = () => {
    closeAll();
    exportPdf(noteTitle, getHtml?.() ?? '');
  };

  const handleImport = async (kind) => {
    closeAll();
    // Importing replaces the whole note body — confirm to avoid accidental loss.
    if (!(await themedConfirm('Import will replace the current note content. Continue?'))) return;
    if (kind === 'md') {
      try {
        const imported = await pickMarkdownImportWithPhotos();
        if (!imported) return;
        onImportMarkdown?.(imported.markdown, {
          title: imported.title || undefined,
          embeddedImages: imported.embedded,
          missingImages: imported.missing
        });
        if (imported.missing > 0 && imported.embedded === 0) {
          await themedAlert(
            'Markdown imported, but no photos were found. For Joplin, export again and import the whole folder that contains _resources.'
          );
        } else if (imported.missing > 0) {
          await themedAlert(
            `Markdown imported with ${imported.embedded} photo(s). ${imported.missing} image link(s) could not be found in the folder.`
          );
        }
      } catch (err) {
        await themedAlert(err?.message || 'Failed to import Markdown.');
      }
      return;
    }
    if (kind === 'pdf') {
      try {
        const buffer = await pickPdfFile();
        if (buffer == null) return;
        const html = await pdfArrayBufferToHtml(buffer);
        onImportHtml?.(prepareImportedHtml(html));
      } catch (err) {
        await themedAlert(err?.message || 'Failed to import PDF. Try a text-based PDF, or export as HTML/Markdown instead.');
      }
      return;
    }
    const text = await pickTextFile('.html,.htm,text/html');
    if (text != null) onImportHtml?.(prepareImportedHtml(text));
  };

  const handleWorkspaceSelection = (kind) => {
    closeAll();
    if (kind === 'payment') onSelectPayment?.();
    else onSelectNotes?.();
  };

  return (
    <>
      <SliderControlButton
        type="button"
        variant="yellow"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        aria-label="File menu"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : undefined}
        onClick={(e) => {
          onBeforeOpen?.();
          setMenuAnchor(e.currentTarget);
        }}
        disabled={disabled}
        sx={buttonSx}
      >
        File
      </SliderControlButton>

      <Menu
        anchorEl={menuAnchor}
        open={open}
        onClose={closeAll}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
      >
        <MenuItem sx={MENU_ITEM_SX} disabled={!ready} onClick={(e) => setImportAnchor(e.currentTarget)} aria-haspopup="menu">
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>Import</ListItemText>
          <span style={{ marginLeft: 12 }}>▸</span>
        </MenuItem>
        <MenuItem sx={MENU_ITEM_SX} disabled={!ready} onClick={(e) => setExportAnchor(e.currentTarget)} aria-haspopup="menu">
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>Export</ListItemText>
          <span style={{ marginLeft: 12 }}>▸</span>
        </MenuItem>
        <Divider sx={{ borderColor: '#000', opacity: 0.4 }} />
        <MenuItem
          sx={MENU_ITEM_SX}
          onClick={() => handleWorkspaceSelection(paymentActive ? 'notes' : 'payment')}
        >
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>
            {paymentActive ? 'Notes' : 'Payment'}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Import submenu */}
      <Menu
        anchorEl={importAnchor}
        open={Boolean(importAnchor)}
        onClose={() => setImportAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
      >
        <MenuItem sx={MENU_ITEM_SX} onClick={() => handleImport('md')}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>
            Markdown (.md / Joplin folder)
          </ListItemText>
        </MenuItem>
        <MenuItem sx={MENU_ITEM_SX} onClick={() => handleImport('html')}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>HTML (.html)</ListItemText>
        </MenuItem>
        <Divider sx={{ borderColor: '#000', opacity: 0.4 }} />
        <MenuItem sx={MENU_ITEM_SX} onClick={() => handleImport('pdf')}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>PDF (.pdf)</ListItemText>
        </MenuItem>
      </Menu>

      {/* Export submenu */}
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
      >
        <MenuItem sx={MENU_ITEM_SX} onClick={handleExportMarkdown}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>Markdown (.md)</ListItemText>
        </MenuItem>
        <MenuItem sx={MENU_ITEM_SX} onClick={handleExportHtml}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>HTML (.html)</ListItemText>
        </MenuItem>
        <Divider sx={{ borderColor: '#000', opacity: 0.4 }} />
        <MenuItem sx={MENU_ITEM_SX} onClick={handleExportPdf}>
          <ListItemText slotProps={{ primary: { sx: MENU_TEXT_SX } }}>PDF (.pdf)</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

PhotoAlbumsFileMenu.propTypes = {
  disabled: PropTypes.bool,
  ready: PropTypes.bool,
  noteTitle: PropTypes.string,
  getHtml: PropTypes.func,
  getMarkdown: PropTypes.func,
  onImportHtml: PropTypes.func,
  onImportMarkdown: PropTypes.func,
  paymentActive: PropTypes.bool,
  onSelectPayment: PropTypes.func,
  onSelectNotes: PropTypes.func,
  buttonSx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  onBeforeOpen: PropTypes.func
};
