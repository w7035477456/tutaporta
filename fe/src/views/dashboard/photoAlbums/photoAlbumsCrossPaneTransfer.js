import {
  createPhotoAlbumsPaneApi,
  fetchPhotoAlbumsNoteAttachmentBlob,
  fetchPhotoAlbumsNoteExtraImageBlob,
  fetchPhotoAlbumsNoteImageBlob
} from 'api/photoAlbumsFe';
import { isPhotoAlbumsInnerEncryptedBody } from 'utils/photoAlbumsNoteInnerCrypto';
import { namesEqualIgnoreCase } from './photoAlbumsCrossPaneDrag';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject(new Error('Empty blob'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function reportTransferProgress(onProgress, percent, label = '') {
  if (typeof onProgress !== 'function') return;
  try {
    await onProgress({
      percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
      label: String(label || '')
    });
  } catch {
    // Progress UI must never fail the transfer.
  }
}

/** Map 0–100 within a note onto an overall [rangeStart, rangeEnd] band. */
function mapProgressRange(rangeStart, rangeEnd, localPercent) {
  const start = Math.max(0, Number(rangeStart) || 0);
  const end = Math.max(start, Number(rangeEnd) || 100);
  const local = Math.max(0, Math.min(100, Number(localPercent) || 0));
  return start + ((end - start) * local) / 100;
}

async function tryImageDataUrl(noteId, slot, storageType) {
  try {
    const blob = await fetchPhotoAlbumsNoteImageBlob(noteId, slot, { storageType });
    if (!blob || blob.size === 0) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function tryExtraImageDataUrl(noteId, imageId, storageType) {
  try {
    const blob = await fetchPhotoAlbumsNoteExtraImageBlob(noteId, imageId, { storageType });
    if (!blob || blob.size === 0) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function tryAttachmentDataUrl(noteId, attachmentId, storageType) {
  try {
    const blob = await fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, {
      inline: false,
      storageType
    });
    if (!blob || blob.size === 0) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Copy one fully loaded source note into targetNotebookId on targetApi.
 * Returns the created note row.
 *
 * Inner-encrypted notes always copy ciphertext + salt (PIN is never cached,
 * so destination remains locked until the user enters the PIN there).
 *
 * @param {{ onProgress?: (p: { percent: number, label?: string }) => (void|Promise<void>), progressRange?: { start?: number, end?: number } }} [opts]
 */
export async function copyNoteBetweenVaults({
  sourceStorageType,
  sourceNoteId,
  targetApi,
  targetNotebookId,
  singlesId = null,
  onProgress = null,
  progressRange = null
}) {
  const rangeStart = Number(progressRange?.start);
  const rangeEnd = Number(progressRange?.end);
  const start = Number.isFinite(rangeStart) ? rangeStart : 0;
  const end = Number.isFinite(rangeEnd) ? rangeEnd : 100;
  const report = (localPercent, label) =>
    reportTransferProgress(onProgress, mapProgressRange(start, end, localPercent), label);

  await report(2, 'Loading note…');
  const sourceApi = createPhotoAlbumsPaneApi(sourceStorageType);
  const full = await sourceApi.fetchPhotoAlbumsNote(sourceNoteId);
  if (!full) throw new Error('Source note not found');

  const noteName = String(full.note_name || '').trim() || 'Note';
  let bodyText = full.body_text != null ? String(full.body_text) : '';
  const keywords = Array.isArray(full.keywords) ? full.keywords : undefined;

  const sourceHasInner =
    Boolean(full.inner_encrypt_enabled) || isPhotoAlbumsInnerEncryptedBody(bodyText);
  const copyInnerEncrypt = sourceHasInner;
  const innerPinSalt = String(full.inner_pin_salt || '').trim();

  await report(12, `Copying “${noteName}”…`);
  const centerImage = full.image_relative_path
    ? await tryImageDataUrl(sourceNoteId, 'center', sourceStorageType)
    : null;

  const created = await targetApi.createPhotoAlbumsNote(targetNotebookId, {
    note_name: noteName,
    body_text: bodyText,
    keywords,
    ...(copyInnerEncrypt
      ? {
          inner_encrypt_enabled: true,
          inner_pin_salt: innerPinSalt
        }
      : {
          inner_encrypt_enabled: false,
          inner_pin_salt: null
        }),
    ...(centerImage ? { image: centerImage } : null)
  });
  const newNoteId = Number(created?.note_id);
  if (!Number.isFinite(newNoteId) || newNoteId < 1) {
    throw new Error('Failed to create note on destination');
  }

  await report(35, `Copying images for “${noteName}”…`);
  const patch = {};
  if (full.image_top_relative_path) {
    const top = await tryImageDataUrl(sourceNoteId, 'top', sourceStorageType);
    if (top) patch.image_top = top;
  }
  if (full.image_bottom_relative_path) {
    const bottom = await tryImageDataUrl(sourceNoteId, 'bottom', sourceStorageType);
    if (bottom) patch.image_bottom = bottom;
  }
  if (Object.keys(patch).length) {
    await targetApi.updatePhotoAlbumsNote(newNoteId, patch);
  }

  const extras = Array.isArray(full.extra_images) ? full.extra_images : [];
  for (let i = 0; i < extras.length; i += 1) {
    const extra = extras[i];
    const imageId = Number(extra?.image_id ?? extra?.id);
    if (!Number.isFinite(imageId) || imageId < 1) continue;
    await report(
      45 + Math.round(((i + 1) / Math.max(1, extras.length)) * 25),
      `Copying image ${i + 1}/${extras.length}…`
    );
    const dataUrl = await tryExtraImageDataUrl(sourceNoteId, imageId, sourceStorageType);
    if (!dataUrl) continue;
    await targetApi.uploadPhotoAlbumsNoteExtraImage(newNoteId, { image: dataUrl });
  }

  const attachments = Array.isArray(full.attachments) ? full.attachments : [];
  for (let i = 0; i < attachments.length; i += 1) {
    const att = attachments[i];
    const attachmentId = Number(att?.attachment_id ?? att?.id);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;
    const fileName =
      String(att?.file_name || att?.fileName || `file_${attachmentId}`).trim() || `file_${attachmentId}`;
    await report(
      70 + Math.round(((i + 1) / Math.max(1, attachments.length)) * 28),
      `Copying ${fileName}…`
    );
    const dataUrl = await tryAttachmentDataUrl(sourceNoteId, attachmentId, sourceStorageType);
    if (!dataUrl) continue;
    await targetApi.uploadPhotoAlbumsNoteAttachment(newNoteId, {
      file: dataUrl,
      file_name: fileName
    });
  }

  await report(100, `Copied “${noteName}”`);
  return created;
}

export function findDuplicateNotebookName(notebooks, name) {
  const list = Array.isArray(notebooks) ? notebooks : [];
  return list.find((nb) => namesEqualIgnoreCase(nb?.notebook_name, name)) || null;
}

export function findDuplicateNoteName(notes, name) {
  const list = Array.isArray(notes) ? notes : [];
  return list.find((n) => namesEqualIgnoreCase(n?.note_name, name)) || null;
}

/**
 * Copy or move a notebook (all notes) or a single note across Cloud↔USB.
 * @returns {{ createdNotebookId?: number, createdNoteId?: number }}
 */
export async function transferPhotoAlbumsItem({
  mode, // 'copy' | 'move'
  item, // { kind, id, storageType, name, notebookId }
  targetStorageType,
  targetNotebookId, // required for note transfers
  targetNotebooks, // current target tree for duplicate checks
  singlesId = null,
  onProgress = null
}) {
  if (mode !== 'copy' && mode !== 'move') throw new Error('Invalid transfer mode');
  const sourceType = item.storageType === 'onedrive' ? 'onedrive' : 'usb';
  const targetType = targetStorageType === 'onedrive' ? 'onedrive' : 'usb';
  if (sourceType === targetType) throw new Error('Source and destination must differ');

  const sourceApi = createPhotoAlbumsPaneApi(sourceType);
  const targetApi = createPhotoAlbumsPaneApi(targetType);
  const copyBandEnd = mode === 'move' ? 92 : 98;

  if (item.kind === 'notebook') {
    await reportTransferProgress(onProgress, 1, 'Loading source notebook…');
    const sourceTree = await sourceApi.fetchPhotoAlbumsTree();
    const sourceNb = (sourceTree.notebooks || []).find((nb) => Number(nb.notebook_id) === Number(item.id));
    if (!sourceNb) throw new Error('Source notebook not found');
    const notebookName = String(sourceNb.notebook_name || item.name || '').trim() || 'Notebook';
    const dup = findDuplicateNotebookName(targetNotebooks, notebookName);
    if (dup) {
      const err = new Error(`Duplicate name ${notebookName}. Rename and try again`);
      err.code = 'DUPLICATE_NAME';
      err.duplicateName = notebookName;
      throw err;
    }

    await reportTransferProgress(onProgress, 4, `Creating “${notebookName}”…`);
    const createdNb = await targetApi.createPhotoAlbumsNotebook(notebookName);
    const newNotebookId = Number(createdNb?.notebook_id);
    if (!Number.isFinite(newNotebookId) || newNotebookId < 1) {
      throw new Error('Failed to create notebook on destination');
    }

    const notes = Array.isArray(sourceNb.notes) ? sourceNb.notes : [];
    const noteCount = Math.max(1, notes.length);
    const notesStart = 5;
    const notesEnd = copyBandEnd;
    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      const noteId = Number(note?.note_id);
      if (!Number.isFinite(noteId) || noteId < 1) continue;
      const bandStart = notesStart + ((notesEnd - notesStart) * i) / noteCount;
      const bandEnd = notesStart + ((notesEnd - notesStart) * (i + 1)) / noteCount;
      await copyNoteBetweenVaults({
        sourceStorageType: sourceType,
        sourceNoteId: noteId,
        targetApi,
        targetNotebookId: newNotebookId,
        singlesId,
        onProgress,
        progressRange: { start: bandStart, end: bandEnd }
      });
    }

    if (mode === 'move') {
      await reportTransferProgress(onProgress, 96, 'Removing source notebook…');
      await sourceApi.deletePhotoAlbumsNotebook(item.id);
    }
    await reportTransferProgress(onProgress, 100, 'Done');
    return { createdNotebookId: newNotebookId };
  }

  // note
  const noteName = String(item.name || '').trim() || 'Note';
  const destNotebookId = Number(targetNotebookId);
  if (!Number.isFinite(destNotebookId) || destNotebookId < 1) {
    throw new Error('Drop the note onto a destination notebook');
  }
  const destNb = (targetNotebooks || []).find((nb) => Number(nb.notebook_id) === destNotebookId);
  const destNotes = Array.isArray(destNb?.notes) ? destNb.notes : [];
  const dupNote = findDuplicateNoteName(destNotes, noteName);
  if (dupNote) {
    const err = new Error(`Duplicate name ${noteName}. Rename and try again`);
    err.code = 'DUPLICATE_NAME';
    err.duplicateName = noteName;
    throw err;
  }

  await reportTransferProgress(onProgress, 1, `Copying “${noteName}”…`);
  const created = await copyNoteBetweenVaults({
    sourceStorageType: sourceType,
    sourceNoteId: item.id,
    targetApi,
    targetNotebookId: destNotebookId,
    singlesId,
    onProgress,
    progressRange: { start: 1, end: copyBandEnd }
  });

  if (mode === 'move') {
    await reportTransferProgress(onProgress, 96, 'Removing source note…');
    await sourceApi.deletePhotoAlbumsNote(item.id);
  }
  await reportTransferProgress(onProgress, 100, 'Done');
  return { createdNoteId: Number(created?.note_id) || null, createdNotebookId: destNotebookId };
}
