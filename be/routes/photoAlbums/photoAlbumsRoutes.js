import {
  buildPhotoAlbumsSearchChain,
  evaluatePhotoAlbumsSearchChain
} from '../../utils/photoAlbumsSearch.js';
import {
  formatDefaultPhotoAlbumsNoteTitle,
  formatDefaultPhotoAlbumsNotebookTitle
} from '../../utils/photoAlbumsDefaultTitle.js';
import { logImpersonatedMutation } from '../../utils/adminAuth.js';
import { requireVaultAccessSession } from '../../utils/photoAlbumsAccessPassword.js';
import {
  requireVaultSession,
  vaultCreateNotebook,
  vaultCreateNote,
  vaultCreateShortcut,
  vaultDeleteNotebook,
  vaultDeleteNote,
  vaultDeleteShortcut,
  vaultGetNoteImage,
  vaultGetTree,
  vaultGetNote,
  vaultEnsureNotePhotoOnDisk,
  vaultEnsureNoteExtraImageOnDisk,
  vaultEnsureNoteAttachmentOnDisk,
  vaultReorderNotebooks,
  vaultReorderNotes,
  vaultReorderShortcuts,
  vaultSearch,
  vaultUpdateNotebook,
  vaultUpdateNote,
  vaultMoveNoteImage,
  vaultAddNoteAttachment,
  vaultDeleteNoteAttachment,
  vaultGetNoteAttachment,
  vaultAddNoteExtraImage,
  vaultDeleteNoteExtraImage,
  vaultGetNoteExtraImage
} from '../../utils/photoAlbumsUsb/vaultSession.js';
import {
  canNativeOpenPhotoAlbumsExtension,
  isPhotoAlbumsNativeOpenSupported,
  openBufferInMacNativeApp
} from '../../utils/photoAlbumsNativeOpen.js';
import {
  extensionFromFileName,
  isAllowedPhotoAlbumsFileExtension,
  mimeTypeForPhotoAlbumsExtension
} from '../../utils/photoAlbumsFileFormats.js';
import { photoAlbumsInlinePreviewPayload } from '../../utils/photoAlbumsInlinePreview.js';
import { parseMediaDataUrl } from '../../utils/parseMediaDataUrl.js';
import { DEFAULT_BODY_TEXT } from '../../utils/photoAlbumsUsb/vaultSchema.js';
import { addVaultSessionFileCounts } from '../../utils/photoAlbumsSessionFileCounts.js';

async function bumpUiFileCount(session, { usb = false } = {}) {
  if (!session?.singlesId) return;
  await addVaultSessionFileCounts(session.singlesId, {
    uiDelta: 1,
    usbDelta: usb && session.storageType !== 'onedrive' ? 1 : 0
  });
}
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'jpe',
  'jif',
  'jfif',
  'jfi',
  'png',
  'apng',
  'gif',
  'svg',
  'svgz',
  'webp',
  'avif',
  'tif',
  'tiff',
  'bmp',
  'dib',
  'heic',
  'heif',
  'ico',
  // Vault-attachable only (not album-slot previewable)
  'raw',
  'cr2',
  'cr3',
  'nef',
  'nrw',
  'arw',
  'dng',
  'orf',
  'pef',
  'rw2',
  'sr2',
  'srf',
  'k25',
  'psd',
  'ai',
  'eps',
  'jxl',
  'jp2',
  'j2k',
  'jpf',
  'jpx',
  'jpm',
  'mj2',
  'tga',
  'wmf',
  'pcx',
  'pict',
  'xcf',
  'indd',
  'ind',
  'indt'
]);

function normalizeNoteImageSlot(raw) {
  const slot = String(raw || 'center').trim().toLowerCase();
  if (slot === 'top' || slot === 'bottom') return slot;
  return 'center';
}

async function requireSinglesId(req, res) {
  return requireVaultAccessSession(req, res);
}

function parseFileDataUrl(dataUrl, fileName = '') {
  const label = String(fileName || '').trim() || '(no file_name)';
  if (!dataUrl || typeof dataUrl !== 'string') {
    console.error('[parseFileDataUrl] missing data URL', { fileName: label, typeofDataUrl: typeof dataUrl });
    return null;
  }

  const parsedMedia = parseMediaDataUrl(dataUrl);
  if (!parsedMedia) {
    console.error('[parseFileDataUrl] invalid data URL (need data:...;base64,...)', {
      fileName: label,
      prefix: dataUrl.slice(0, 120),
      length: dataUrl.length
    });
    return null;
  }

  const contentType = parsedMedia.contentType;
  let buffer;
  try {
    buffer = Buffer.from(parsedMedia.base64, 'base64');
  } catch (err) {
    console.error('[parseFileDataUrl] base64 decode failed', { fileName: label, error: err?.message || err });
    return null;
  }
  if (!buffer.length) {
    console.error('[parseFileDataUrl] empty buffer after decode', { fileName: label, contentType });
    return null;
  }

  let ext = extensionFromFileName(fileName);
  if (!ext && (contentType.includes('pdf') || contentType.includes('x-pdf'))) ext = 'pdf';
  else if (!ext && (contentType.includes('presentationml') || contentType.includes('powerpoint'))) {
    ext = contentType.includes('openxml') ? 'pptx' : 'ppt';
  } else if (!ext && (contentType.includes('wordprocessingml') || contentType.includes('msword'))) {
    ext = contentType.includes('openxml') ? 'docx' : 'doc';
  } else if (!ext && (contentType.includes('spreadsheetml') || contentType.includes('ms-excel'))) {
    ext = contentType.includes('openxml') ? 'xlsx' : 'xls';
  } else if (!ext && contentType.includes('json')) ext = 'json';
  else if (!ext && contentType.includes('csv')) ext = 'csv';
  else if (!ext && contentType.includes('javascript')) ext = 'js';
  else if (!ext && contentType.includes('zip')) ext = 'zip';
  else if (!ext && contentType.includes('mpeg')) ext = 'mp3';
  else if (!ext && (contentType.includes('mp4') || contentType.includes('m4v'))) ext = 'mp4';
  else if (!ext && contentType.includes('quicktime')) ext = 'mov';
  else if (!ext && (contentType.includes('msvideo') || contentType.includes('avi'))) ext = 'avi';
  else if (!ext && contentType.includes('wmv')) ext = 'wmv';
  else if (!ext && contentType.includes('svg')) ext = 'svg';
  else if (!ext && contentType.includes('avif')) ext = 'avif';
  else if (!ext && contentType.includes('webp')) ext = 'webp';
  else if (!ext && contentType.includes('png')) ext = 'png';
  else if (!ext && contentType.includes('gif')) ext = 'gif';
  else if (!ext && (contentType.includes('jpeg') || contentType.includes('jpg'))) ext = 'jpg';
  else if (!ext && contentType.includes('tiff')) ext = 'tiff';
  else if (!ext && contentType.includes('bmp')) ext = 'bmp';
  else if (!ext && contentType.includes('heic')) ext = 'heic';
  else if (!ext && contentType.includes('heif')) ext = 'heif';
  else if (!ext && contentType.includes('jxl')) ext = 'jxl';
  else if (!ext && (contentType.includes('jp2') || contentType.includes('jpx'))) ext = 'jp2';
  else if (!ext && contentType.includes('targa')) ext = 'tga';
  else if (!ext && contentType.includes('plain')) ext = 'txt';
  else if (!ext && contentType.includes('html')) ext = 'html';

  if (!ext || !isAllowedPhotoAlbumsFileExtension(ext)) {
    console.error('[parseFileDataUrl] unsupported vault file type', {
      fileName: label,
      contentType,
      resolvedExt: ext || null,
      nameExt: extensionFromFileName(fileName),
      bufferBytes: buffer.length
    });
    return null;
  }

  console.log('[parseFileDataUrl] ok', {
    fileName: label,
    contentType,
    ext,
    bufferBytes: buffer.length
  });

  return {
    buffer,
    contentType: contentType || mimeTypeForPhotoAlbumsExtension(ext),
    ext,
    fileName: String(fileName || `file.${ext}`).trim().slice(0, 240) || `file.${ext}`
  };
}

function parseImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim().toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return null;
  let ext = 'jpg';
  if (contentType.includes('apng')) ext = 'apng';
  else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('gif')) ext = 'gif';
  else if (contentType.includes('webp')) ext = 'webp';
  else if (contentType.includes('avif')) ext = 'avif';
  else if (contentType.includes('bmp')) ext = 'bmp';
  else if (contentType.includes('svg')) ext = 'svg';
  else if (contentType.includes('tiff') || contentType.includes('tif')) ext = 'tiff';
  else if (contentType.includes('icon')) ext = 'ico';
  else if (contentType.includes('heic')) ext = 'heic';
  else if (contentType.includes('heif')) ext = 'heif';
  else if (contentType.includes('photoshop') || contentType.includes('psd')) ext = 'psd';
  else if (contentType.includes('illustrator')) ext = 'ai';
  else if (contentType.includes('postscript') || contentType.includes('eps')) ext = 'eps';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
  return { buffer, contentType, ext };
}

/** Inner PIN must never be posted — E2E encrypt/decrypt is client-only. */
function rejectInnerPinSecretsInBody(req, res) {
  const body = req.body || {};
  const banned = ['pin', 'inner_pin', 'innerPin', 'vault_pin', 'vaultPin', 'inner_password', 'innerPassword'];
  for (const key of banned) {
    if (body[key] != null && String(body[key]).trim() !== '') {
      res.status(400).json({
        error: 'Inner PIN must never be sent to the server (client-side E2E only)'
      });
      return true;
    }
  }
  return false;
}

function buildNoteImagePatch(req) {
  const patch = {};
  if (req.body?.notebook_id != null) patch.notebook_id = Number(req.body.notebook_id);
  if (req.body?.note_name != null) patch.note_name = String(req.body.note_name).trim().slice(0, 120);
  if (req.body?.body_text != null) patch.body_text = String(req.body.body_text);
  if (req.body?.keywords != null) patch.keywords = req.body.keywords;
  if (req.body?.inner_encrypt_enabled != null) {
    patch.inner_encrypt_enabled = Boolean(req.body.inner_encrypt_enabled);
  }
  // Salt is non-secret KDF material (or null for v2 embedded-in-body). Never a PIN.
  if (req.body?.inner_pin_salt !== undefined) {
    patch.inner_pin_salt =
      req.body.inner_pin_salt == null ? null : String(req.body.inner_pin_salt).trim().slice(0, 512);
  }
  if (req.body?.inner_unlock_locked_until !== undefined) {
    patch.inner_unlock_locked_until =
      req.body.inner_unlock_locked_until == null || req.body.inner_unlock_locked_until === ''
        ? null
        : String(req.body.inner_unlock_locked_until).trim().slice(0, 64);
  }
  if (req.body?.clear_image === true) patch.clear_image = true;
  if (req.body?.clear_image_top === true) patch.clear_image_top = true;
  if (req.body?.clear_image_bottom === true) patch.clear_image_bottom = true;

  const parsedImage = parseImageDataUrl(req.body?.image);
  const parsedTopImage = parseImageDataUrl(req.body?.image_top);
  const parsedBottomImage = parseImageDataUrl(req.body?.image_bottom);
  if (parsedImage) {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(parsedImage.ext)) {
      throw new Error('Unsupported image type');
    }
    patch.imageParsed = parsedImage;
  }
  if (parsedTopImage) {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(parsedTopImage.ext)) {
      throw new Error('Unsupported image type');
    }
    patch.image_topParsed = parsedTopImage;
  }
  if (parsedBottomImage) {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(parsedBottomImage.ext)) {
      throw new Error('Unsupported image type');
    }
    patch.image_bottomParsed = parsedBottomImage;
  }
  return patch;
}

/** GET /api/photoAlbums */
export async function getPhotoAlbumsTree(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;
  try {
    const tree = vaultGetTree(session);
    if (!session.sessionFileCountsTreeReported) {
      session.sessionFileCountsTreeReported = true;
      const notebooks = Array.isArray(tree?.notebooks) ? tree.notebooks : [];
      let noteCount = 0;
      for (const nb of notebooks) {
        noteCount += Array.isArray(nb?.notes) ? nb.notes.length : 0;
      }
      const itemCount = notebooks.length + noteCount;
      if (itemCount > 0) {
        // USB open already counted notebooks/notes on unlock; tree only adds UI hop.
        await addVaultSessionFileCounts(session.singlesId, { uiDelta: itemCount });
      }
    }
    return res.json(tree);
  } catch (err) {
    console.error('[getPhotoAlbumsTree]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load record vault' });
  }
}

/** GET /api/photoAlbums/notes/:noteId — full note content (lazy load; one note at a time). */
export async function getPhotoAlbumsNote(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  try {
    const note = vaultGetNote(session, noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    await addVaultSessionFileCounts(session.singlesId, { uiDelta: 1 });
    return res.json({ note });
  } catch (err) {
    console.error('[getPhotoAlbumsNote]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load note' });
  }
}

/** POST /api/photoAlbums/notebooks */
export async function createPhotoAlbumsNotebook(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;
  try {
    const requestedName = String(req.body?.notebook_name ?? '').trim();
    let name = requestedName;
    if (!name) {
      const tree = vaultGetTree(session);
      name = formatDefaultPhotoAlbumsNotebookTitle(tree.notebooks.length + 1);
    }
    const row = vaultCreateNotebook(session, name.slice(0, 120));
    logImpersonatedMutation(req);
    await bumpUiFileCount(session, { usb: true });
    return res.json({
      notebook: {
        notebook_id: Number(row.notebook_id),
        notebook_name: row.notebook_name,
        display_order: Number(row.display_order),
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    });
  } catch (err) {
    console.error('[createPhotoAlbumsNotebook]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to create notebook' });
  }
}

/** PATCH /api/photoAlbums/notebooks/:notebookId */
export async function updatePhotoAlbumsNotebook(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const notebookId = Number(req.params.notebookId);
  if (!Number.isFinite(notebookId) || notebookId < 1) {
    return res.status(400).json({ error: 'Invalid notebook id' });
  }

  const notebookName = req.body?.notebook_name;
  if (notebookName == null || !String(notebookName).trim()) {
    return res.status(400).json({ error: 'notebook_name is required' });
  }

  try {
    const row = vaultUpdateNotebook(session, notebookId, String(notebookName).trim().slice(0, 120));
    if (!row) return res.status(404).json({ error: 'Notebook not found' });
    logImpersonatedMutation(req);
    return res.json({
      notebook: {
        notebook_id: Number(row.notebook_id),
        notebook_name: row.notebook_name,
        display_order: Number(row.display_order),
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    });
  } catch (err) {
    console.error('[updatePhotoAlbumsNotebook]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to update notebook' });
  }
}

/** DELETE /api/photoAlbums/notebooks/:notebookId */
export async function deletePhotoAlbumsNotebook(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const notebookId = Number(req.params.notebookId);
  if (!Number.isFinite(notebookId) || notebookId < 1) {
    return res.status(400).json({ error: 'Invalid notebook id' });
  }

  try {
    vaultDeleteNotebook(session, notebookId);
    logImpersonatedMutation(req);
    return res.json({ success: true, notebook_id: notebookId, soft_deleted: true });
  } catch (err) {
    console.error('[deletePhotoAlbumsNotebook]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to delete notebook' });
  }
}

/** POST /api/photoAlbums/notebooks/:notebookId/notes */
export async function createPhotoAlbumsNote(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;
  if (rejectInnerPinSecretsInBody(req, res)) return;

  const notebookId = Number(req.params.notebookId);
  if (!Number.isFinite(notebookId) || notebookId < 1) {
    return res.status(400).json({ error: 'Invalid notebook id' });
  }

  try {
    const requestedName = String(req.body?.note_name ?? '').trim();
    let noteName = requestedName;
    if (!noteName) {
      const tree = vaultGetTree(session);
      const nbIdx = tree.notebooks.findIndex((nb) => nb.notebook_id === notebookId);
      const noteCount = tree.notebooks.find((nb) => nb.notebook_id === notebookId)?.notes?.length ?? 0;
      noteName = formatDefaultPhotoAlbumsNoteTitle(nbIdx >= 0 ? nbIdx + 1 : 1, noteCount + 1);
    }
    const parsedImage = parseImageDataUrl(req.body?.image);
    if (parsedImage && !ALLOWED_IMAGE_EXTENSIONS.has(parsedImage.ext)) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }
    const note = await vaultCreateNote(session, notebookId, {
      noteName: noteName.slice(0, 120),
      bodyText: String(req.body?.body_text ?? DEFAULT_BODY_TEXT),
      keywords: req.body?.keywords,
      imageBuffer: parsedImage?.buffer,
      imageExt: parsedImage?.ext,
      innerEncryptEnabled: Boolean(req.body?.inner_encrypt_enabled),
      innerPinSalt: req.body?.inner_pin_salt
    });
    logImpersonatedMutation(req);
    await bumpUiFileCount(session, { usb: true });
    return res.json({ note });
  } catch (err) {
    console.error('[createPhotoAlbumsNote]', err?.message || err);
    return res.status(err?.message === 'Notebook not found' ? 404 : 500).json({
      error: err?.message || 'Failed to create note'
    });
  }
}

/** PATCH /api/photoAlbums/notes/:noteId */
export async function updatePhotoAlbumsNote(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;
  if (rejectInnerPinSecretsInBody(req, res)) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  try {
    const patch = buildNoteImagePatch(req);
    const note = vaultUpdateNote(session, noteId, patch);
    logImpersonatedMutation(req);
    await bumpUiFileCount(session, { usb: true });
    return res.json({ note });
  } catch (err) {
    console.error('[updatePhotoAlbumsNote]', err?.message || err);
    const message = err?.message || 'Failed to update note';
    if (message === 'Note not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Unsupported image type') {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}

/** POST /api/photoAlbums/notes/move-image */
export async function movePhotoAlbumsNoteImage(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const fromNoteId = Number(req.body?.from_note_id ?? req.body?.fromNoteId);
  const toNoteId = Number(req.body?.to_note_id ?? req.body?.toNoteId);
  const fromSlot = String(req.body?.from_slot ?? req.body?.fromSlot ?? '').trim();
  const toSlot = String(req.body?.to_slot ?? req.body?.toSlot ?? '').trim();

  if (!Number.isFinite(fromNoteId) || fromNoteId < 1 || !Number.isFinite(toNoteId) || toNoteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }
  if (!fromSlot || !toSlot) {
    return res.status(400).json({ error: 'from_slot and to_slot are required' });
  }

  try {
    const result = vaultMoveNoteImage(session, fromNoteId, fromSlot, toNoteId, toSlot);
    logImpersonatedMutation(req);
    return res.json(result);
  } catch (err) {
    console.error('[movePhotoAlbumsNoteImage]', err?.message || err);
    return res.status(err?.message === 'Note not found' ? 404 : 500).json({
      error: err?.message || 'Failed to move note image'
    });
  }
}

/** DELETE /api/photoAlbums/notes/:noteId */
export async function deletePhotoAlbumsNote(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  try {
    vaultDeleteNote(session, noteId);
    logImpersonatedMutation(req);
    return res.json({ success: true, note_id: noteId, soft_deleted: true });
  } catch (err) {
    console.error('[deletePhotoAlbumsNote]', err?.message || err);
    return res.status(err?.message === 'Note not found' ? 404 : 500).json({
      error: err?.message || 'Failed to delete note'
    });
  }
}

/** GET /api/photoAlbums/notes/:noteId/image[/top|bottom] */
export async function getPhotoAlbumsNoteImage(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }
  const slot = normalizeNoteImageSlot(req.params.slot || String(req.path || '').split('/').pop());

  try {
    await vaultEnsureNotePhotoOnDisk(session, noteId, slot);
    const image = vaultGetNoteImage(session, noteId, slot);
    if (!image) return res.status(404).json({ error: 'Image file not found' });
    await bumpUiFileCount(session);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(image.buffer);
  } catch (err) {
    console.error('[getPhotoAlbumsNoteImage]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load image' });
  }
}

/** GET /api/photoAlbums/notes/:noteId/extra-images/:imageId */
export async function getPhotoAlbumsNoteExtraImage(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  const imageId = Number(req.params.imageId);
  if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(imageId) || imageId < 1) {
    return res.status(400).json({ error: 'Invalid note or image id' });
  }

  try {
    await vaultEnsureNoteExtraImageOnDisk(session, noteId, imageId);
    const image = vaultGetNoteExtraImage(session, noteId, imageId);
    if (!image) return res.status(404).json({ error: 'Image file not found' });
    await bumpUiFileCount(session);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(image.buffer);
  } catch (err) {
    console.error('[getPhotoAlbumsNoteExtraImage]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load image' });
  }
}

/** POST /api/photoAlbums/notes/:noteId/extra-images */
export async function uploadPhotoAlbumsNoteExtraImage(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  const parsed = parseImageDataUrl(req.body?.image);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid image data' });
  }
  if (!ALLOWED_IMAGE_EXTENSIONS.has(parsed.ext)) {
    return res.status(400).json({ error: 'Unsupported image type' });
  }

  try {
    const note = vaultAddNoteExtraImage(session, noteId, { buffer: parsed.buffer, ext: parsed.ext });
    logImpersonatedMutation(req);
    await bumpUiFileCount(session, { usb: true });
    return res.json({ note });
  } catch (err) {
    console.error('[uploadPhotoAlbumsNoteExtraImage]', err?.message || err);
    const message = err?.message || 'Failed to upload image';
    if (message === 'Note not found') return res.status(404).json({ error: message });
    return res.status(500).json({ error: message });
  }
}

/** DELETE /api/photoAlbums/notes/:noteId/extra-images/:imageId */
export async function deletePhotoAlbumsNoteExtraImage(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  const imageId = Number(req.params.imageId);
  if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(imageId) || imageId < 1) {
    return res.status(400).json({ error: 'Invalid note or image id' });
  }

  try {
    const note = vaultDeleteNoteExtraImage(session, noteId, imageId);
    logImpersonatedMutation(req);
    return res.json({ note });
  } catch (err) {
    console.error('[deletePhotoAlbumsNoteExtraImage]', err?.message || err);
    const message = err?.message || 'Failed to delete image';
    if (message === 'Note not found' || message === 'Image not found') {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}

/** PUT /api/photoAlbums/notebooks/reorder */
export async function reorderPhotoAlbumsNotebooks(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const rawIds = req.body?.notebook_ids;
  if (!Array.isArray(rawIds) || !rawIds.length) {
    return res.status(400).json({ error: 'notebook_ids array is required' });
  }

  const notebookIds = rawIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!notebookIds.length) {
    return res.status(400).json({ error: 'notebook_ids must contain valid ids' });
  }

  try {
    vaultReorderNotebooks(session, notebookIds);
    logImpersonatedMutation(req);
    return res.json({ success: true, notebook_ids: notebookIds });
  } catch (err) {
    console.error('[reorderPhotoAlbumsNotebooks]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to reorder notebooks' });
  }
}

/** PUT /api/photoAlbums/notebooks/:notebookId/notes/reorder */
export async function reorderPhotoAlbumsNotes(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const notebookId = Number(req.params.notebookId);
  if (!Number.isFinite(notebookId) || notebookId < 1) {
    return res.status(400).json({ error: 'Invalid notebook id' });
  }

  const rawIds = req.body?.note_ids;
  if (!Array.isArray(rawIds) || !rawIds.length) {
    return res.status(400).json({ error: 'note_ids array is required' });
  }

  const noteIds = rawIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!noteIds.length) {
    return res.status(400).json({ error: 'note_ids must contain valid ids' });
  }

  try {
    vaultReorderNotes(session, notebookId, noteIds);
    logImpersonatedMutation(req);
    return res.json({ success: true, note_ids: noteIds });
  } catch (err) {
    console.error('[reorderPhotoAlbumsNotes]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to reorder notes' });
  }
}

/** POST /api/photoAlbums/shortcuts */
export async function createPhotoAlbumsShortcut(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const targetType = String(req.body?.target_type ?? '').trim().toLowerCase();
  const notebookId = Number(req.body?.notebook_id);
  const noteId = req.body?.note_id != null ? Number(req.body.note_id) : null;

  if (targetType !== 'notebook' && targetType !== 'note') {
    return res.status(400).json({ error: 'target_type must be notebook or note' });
  }
  if (!Number.isFinite(notebookId) || notebookId < 1) {
    return res.status(400).json({ error: 'Invalid notebook id' });
  }
  if (targetType === 'note' && (!Number.isFinite(noteId) || noteId < 1)) {
    return res.status(400).json({ error: 'note_id is required for note shortcuts' });
  }

  try {
    const shortcut = vaultCreateShortcut(session, { targetType, notebookId, noteId });
    logImpersonatedMutation(req);
    return res.json({ shortcut });
  } catch (err) {
    console.error('[createPhotoAlbumsShortcut]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to create shortcut' });
  }
}

/** DELETE /api/photoAlbums/shortcuts/:shortcutId */
export async function deletePhotoAlbumsShortcut(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const shortcutId = Number(req.params.shortcutId);
  if (!Number.isFinite(shortcutId) || shortcutId < 1) {
    return res.status(400).json({ error: 'Invalid shortcut id' });
  }

  try {
    vaultDeleteShortcut(session, shortcutId);
    logImpersonatedMutation(req);
    return res.json({ success: true, shortcut_id: shortcutId });
  } catch (err) {
    console.error('[deletePhotoAlbumsShortcut]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to delete shortcut' });
  }
}

/** PUT /api/photoAlbums/shortcuts/reorder */
export async function reorderPhotoAlbumsShortcuts(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const rawIds = req.body?.shortcut_ids;
  if (!Array.isArray(rawIds) || !rawIds.length) {
    return res.status(400).json({ error: 'shortcut_ids array is required' });
  }

  const shortcutIds = rawIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!shortcutIds.length) {
    return res.status(400).json({ error: 'shortcut_ids must contain valid ids' });
  }

  try {
    vaultReorderShortcuts(session, shortcutIds);
    logImpersonatedMutation(req);
    return res.json({ success: true, shortcut_ids: shortcutIds });
  } catch (err) {
    console.error('[reorderPhotoAlbumsShortcuts]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to reorder shortcuts' });
  }
}

/** GET /api/photoAlbums/notes/:noteId/attachments/:attachmentId */
export async function getPhotoAlbumsNoteAttachment(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) {
    return res.status(400).json({ error: 'Invalid note or attachment id' });
  }

  try {
    await vaultEnsureNoteAttachmentOnDisk(session, noteId, attachmentId);
    const file = vaultGetNoteAttachment(session, noteId, attachmentId);
    if (!file) return res.status(404).json({ error: 'Attachment not found' });
    await bumpUiFileCount(session);
    const inline =
      req.query.inline === '1' || req.query.inline === 'true' || req.query.view === '1' || req.query.view === 'true';
    let payload = file.buffer;
    let contentType = file.contentType || 'application/octet-stream';
    if (inline) {
      const preview = await photoAlbumsInlinePreviewPayload(
        file.buffer,
        file.fileExtension || String(file.fileName || '').split('.').pop() || '',
        contentType
      );
      payload = preview.buffer;
      contentType = preview.contentType || contentType;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.fileName || 'file')}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(payload);
  } catch (err) {
    console.error('[getPhotoAlbumsNoteAttachment]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load attachment' });
  }
}

/** POST /api/photoAlbums/notes/:noteId/attachments/:attachmentId/open-native — Mac only; opens Word/Excel via `open`. */
export async function openPhotoAlbumsNoteAttachmentNative(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  if (!isPhotoAlbumsNativeOpenSupported()) {
    return res.status(501).json({
      error: 'Native app open is only available when the app server is running on Mac',
      code: 'NATIVE_OPEN_UNSUPPORTED'
    });
  }

  const noteId = Number(req.params.noteId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) {
    return res.status(400).json({ error: 'Invalid note or attachment id' });
  }

  try {
    await vaultEnsureNoteAttachmentOnDisk(session, noteId, attachmentId);
    const file = vaultGetNoteAttachment(session, noteId, attachmentId);
    if (!file) return res.status(404).json({ error: 'Attachment not found' });

    const ext = String(file.fileName || '')
      .trim()
      .toLowerCase()
      .split('.')
      .pop();
    if (!canNativeOpenPhotoAlbumsExtension(ext)) {
      return res.status(400).json({ error: 'This file type cannot be opened in a desktop office app' });
    }

    await openBufferInMacNativeApp(file.buffer, file.fileName, ext);
    logImpersonatedMutation(req);
    return res.json({ success: true, opened: true });
  } catch (err) {
    console.error('[openPhotoAlbumsNoteAttachmentNative]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to open attachment in desktop app' });
  }
}

/** POST /api/photoAlbums/notes/:noteId/attachments */
export async function uploadPhotoAlbumsNoteAttachment(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  const parsed = parseFileDataUrl(req.body?.file, req.body?.file_name);
  if (!parsed) {
    console.error('[uploadPhotoAlbumsNoteAttachment] rejected', {
      noteId,
      fileName: req.body?.file_name,
      hasFile: Boolean(req.body?.file),
      filePrefix:
        typeof req.body?.file === 'string' ? String(req.body.file).slice(0, 120) : typeof req.body?.file
    });
    return res.status(400).json({
      error: 'Unsupported or invalid vault file type',
      file_name: req.body?.file_name || null,
      detail: 'File failed vault type/data-URL validation. Check server log [parseFileDataUrl].'
    });
  }

  try {
    const attachment = vaultAddNoteAttachment(session, noteId, {
      buffer: parsed.buffer,
      fileName: parsed.fileName,
      ext: parsed.ext,
      mimeType: parsed.contentType
    });
    logImpersonatedMutation(req);
    if (!attachment?.duplicate) {
      await bumpUiFileCount(session, { usb: true });
    }
    return res.json({ attachment });
  } catch (err) {
    console.error('[uploadPhotoAlbumsNoteAttachment]', err?.message || err);
    const message = err?.message || 'Failed to upload attachment';
    if (message === 'Note not found') return res.status(404).json({ error: message });
    return res.status(500).json({ error: message });
  }
}

/** DELETE /api/photoAlbums/notes/:noteId/attachments/:attachmentId */
export async function deletePhotoAlbumsNoteAttachment(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const noteId = Number(req.params.noteId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) {
    return res.status(400).json({ error: 'Invalid note or attachment id' });
  }

  try {
    const result = vaultDeleteNoteAttachment(session, noteId, attachmentId);
    logImpersonatedMutation(req);
    return res.json(result);
  } catch (err) {
    console.error('[deletePhotoAlbumsNoteAttachment]', err?.message || err);
    const message = err?.message || 'Failed to delete attachment';
    if (message === 'Attachment not found' || message === 'Note not found') {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}

/** GET /api/photoAlbums/search */
export async function searchPhotoAlbumsNotes(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const q1 = String(req.query?.q1 ?? req.query?.q ?? '').trim();
  const q2 = String(req.query?.q2 ?? '').trim();
  const q3 = String(req.query?.q3 ?? '').trim();
  const op1 = String(req.query?.op1 ?? 'and').toLowerCase() === 'or' ? 'or' : 'and';
  const op2 = String(req.query?.op2 ?? 'and').toLowerCase() === 'or' ? 'or' : 'and';

  const chain = buildPhotoAlbumsSearchChain(q1, q2, q3, op1, op2);
  if (!chain.length) {
    return res.json({ results: [] });
  }

  try {
    const results = vaultSearch(session, chain, evaluatePhotoAlbumsSearchChain);
    return res.json({ results });
  } catch (err) {
    console.error('[searchPhotoAlbumsNotes]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Search failed' });
  }
}
