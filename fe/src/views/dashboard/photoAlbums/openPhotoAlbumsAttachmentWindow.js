import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { getPhotoAlbumsAttachmentViewKind } from 'utils/photoAlbumsFileFormats';
import { trimSolidImageBorder } from 'utils/trimSolidImageBorder';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeLoadingDocument(win, fileName) {
  const title = escapeHtml(fileName || 'Attachment');
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#111;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
</style></head><body><p>Loading ${title}…</p></body></html>`);
  win.document.close();
}

function writeMessageDocument(win, fileName, message) {
  const title = escapeHtml(fileName || 'Attachment');
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#111;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center}
</style></head><body><p>${escapeHtml(message)}</p></body></html>`);
  win.document.close();
}

function writeHtmlDocument(win, fileName, bodyHtml, { pre = false } = {}) {
  const title = escapeHtml(fileName || 'Attachment');
  const body = pre
    ? `<pre style="margin:0;padding:24px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.45">${escapeHtml(bodyHtml)}</pre>`
    : bodyHtml;
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#111;color:#f5f5f5}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #666;padding:6px;text-align:left}
  th{background:#222}
  img,video{max-width:100%}
  a{color:#8ec8ff}
</style></head><body>${body}</body></html>`);
  win.document.close();
}

function xlsxRowsToHtml(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '<p>This spreadsheet is empty.</p>';
  const [headerRow, ...bodyRows] = safeRows;
  const headerCells = Array.isArray(headerRow) ? headerRow : [];
  const thead = headerCells.length
    ? `<thead><tr>${headerCells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const dataRows = headerCells.length ? bodyRows : safeRows;
  const tbody = `<tbody>${dataRows
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('')}</tbody>`;
  return `<div style="padding:16px;overflow:auto"><table>${thead}${tbody}</table></div>`;
}

function blobWithMime(blob, mime) {
  if (!mime || blob?.type === mime) return blob;
  return new Blob([blob], { type: mime });
}

/**
 * View-window chrome: dark series → black, light series → white (both letterbox sides match).
 */
function readViewerChromeBackground() {
  try {
    const surface = String(document.documentElement.getAttribute('data-theme-surface') || '')
      .trim()
      .toLowerCase();
    if (surface === 'dark') return '#000000';
    if (surface === 'light') return '#ffffff';

    const stored = String(localStorage.getItem('vsingles:theme-choice') || '').trim();
    if (/\bdark$/i.test(stored)) return '#000000';
    if (/\blight$/i.test(stored)) return '#ffffff';

    const raw = String(
      getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || ''
    )
      .trim()
      .toLowerCase();
    if (raw === '#000' || raw === '#000000' || raw === 'black') return '#000000';
    if (raw === '#fff' || raw === '#ffffff' || raw === 'white') return '#ffffff';
    const nums = raw.match(/\d+(\.\d+)?/g);
    if (nums && nums.length >= 3) {
      const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5 ? '#000000' : '#ffffff';
      }
    }
  } catch {
    // ignore
  }
  return '#000000';
}

/**
 * Open an attachment preview in a real browser window (not an in-app modal).
 * Pass `win` from a synchronous window.open() in the click handler to avoid pop-up blockers.
 */
export async function openPhotoAlbumsAttachmentInNewWindow({
  noteId,
  attachment,
  storageType = null,
  win: existingWin = null
} = {}) {
  const attachmentId = Number(attachment?.attachment_id);
  const fileName = String(attachment?.file_name || `file.${attachment?.file_extension || 'bin'}`);
  const ext = String(attachment?.file_extension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const viewKind = getPhotoAlbumsAttachmentViewKind(ext);

  const win = existingWin || window.open('', '_blank');
  if (!win) {
    throw new Error('Pop-up blocked — allow pop-ups to view files in a new window');
  }
  try {
    win.opener = null;
  } catch {
    // ignore
  }

  if (!viewKind || !Number.isFinite(attachmentId) || attachmentId < 1) {
    writeMessageDocument(win, fileName, 'This file type cannot be previewed.');
    return;
  }

  if (viewKind === 'legacy-office') {
    writeMessageDocument(
      win,
      fileName,
      'Legacy Word, Excel, and PowerPoint files (.doc, .xls, .ppt, .pptx) cannot be previewed in the browser. Use Launch (Mac desktop app) or Download.'
    );
    return;
  }

  writeLoadingDocument(win, fileName);

  try {
    const blob = await fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, {
      storageType
    });

    if (viewKind === 'pdf') {
      const url = URL.createObjectURL(blobWithMime(blob, 'application/pdf'));
      win.location.replace(url);
      return;
    }

    if (viewKind === 'video') {
      const url = URL.createObjectURL(blob);
      writeHtmlDocument(
        win,
        fileName,
        `<video controls autoplay style="width:100%;height:100vh;background:#000" src="${url}"></video>`
      );
      return;
    }

    if (viewKind === 'image') {
      const mimeByExt = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        jpe: 'image/jpeg',
        jif: 'image/jpeg',
        jfif: 'image/jpeg',
        jfi: 'image/jpeg',
        png: 'image/png',
        apng: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        avif: 'image/avif',
        bmp: 'image/bmp',
        dib: 'image/bmp',
        svg: 'image/svg+xml',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        ico: 'image/x-icon'
      };
      const mime = mimeByExt[ext] || blob.type || 'image/*';
      // Step 1: strip solid matte borders baked into the file (white/black/any flat color).
      const trimmedBlob = await trimSolidImageBorder(blobWithMime(blob, mime));
      const url = URL.createObjectURL(blobWithMime(trimmedBlob, mime));
      // Step 2–3: theme chrome (dark→black / light→white) + maximal contain fit (no crop zoom).
      const title = escapeHtml(fileName);
      const chromeBg = escapeHtml(readViewerChromeBackground());
      win.document.open();
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  html,body{margin:0;height:100%;background:${chromeBg};overflow:hidden}
  .rv-view{width:100%;height:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:${chromeBg}}
  .rv-view img{width:100%;height:100%;object-fit:contain;object-position:center;display:block;background:${chromeBg}}
</style></head><body><div class="rv-view"><img alt="${title}" src="${url}" /></div></body></html>`);
      win.document.close();
      return;
    }

    if (viewKind === 'audio') {
      const url = URL.createObjectURL(blob);
      writeHtmlDocument(
        win,
        fileName,
        `<div style="padding:48px;text-align:center"><audio controls autoplay src="${url}"></audio></div>`
      );
      return;
    }

    if (ext === 'html' || ext === 'htm') {
      const url = URL.createObjectURL(blobWithMime(blob, 'text/html'));
      win.location.replace(url);
      return;
    }

    if (viewKind === 'text') {
      const text = await blob.text();
      writeHtmlDocument(win, fileName, text, { pre: true });
      return;
    }

    if (viewKind === 'docx') {
      const mammoth = await import('mammoth');
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      writeHtmlDocument(win, fileName, `<div style="padding:24px">${String(result?.value || '')}</div>`);
      return;
    }

    if (viewKind === 'xlsx') {
      const readXlsxFile = (await import('read-excel-file/browser')).default;
      const rows = await readXlsxFile(blob);
      writeHtmlDocument(win, fileName, xlsxRowsToHtml(rows));
    }
  } catch (err) {
    writeMessageDocument(win, fileName, err?.message || 'Failed to load file preview');
    throw err;
  }
}
