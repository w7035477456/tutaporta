import { vaultGetNote, vaultGetNoteAttachment } from './recordVaultUsb/vaultSession.js';
import { expandRecordVaultBodyTextForSearch } from './recordVaultSearch.js';

/**
 * Load note bodies + attachment bytes for RAG. Skips missing notes; rejects inner-encrypted notes.
 * Must await vaultGetNote / vaultGetNoteAttachment (Postgres vaultSession is async).
 * @param {import('./recordVaultUsb/vaultSession.js').VaultSession} session
 * @param {number[]} noteIds
 */
export async function collectRecordVaultNotesForRag(session, noteIds) {
  const ids = [...new Set((noteIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) {
    const err = new Error('Select at least one note using the RAG checkboxes.');
    err.code = 'RAG_NO_NOTES';
    throw err;
  }

  const notes = [];
  const skipped = [];
  const emptyBodyTitles = [];
  let pdfAttachmentCount = 0;
  let pdfBytesTotal = 0;

  for (const noteId of ids) {
    const note = await vaultGetNote(session, noteId);
    if (!note) {
      skipped.push({ noteId, reason: 'not_found' });
      continue;
    }
    if (note.inner_encrypt_enabled) {
      const err = new Error(
        `“${note.note_name || 'Note'}” is PIN-locked. Unlock it before including it in RAG.`
      );
      err.code = 'RAG_INNER_LOCKED';
      throw err;
    }

    const attachments = [];
    for (const att of note.attachments || []) {
      const attachmentId = Number(att.attachment_id);
      if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;
      const got = await vaultGetNoteAttachment(session, noteId, attachmentId);
      if (!got?.buffer?.length) continue;
      let ext = String(att.file_extension || '').toLowerCase().replace(/^\./, '');
      const fileName = String(att.file_name || got.fileName || 'attachment');
      if (!ext && fileName.toLowerCase().endsWith('.pdf')) ext = 'pdf';
      attachments.push({
        file_name: fileName,
        file_extension: ext,
        content_base64: got.buffer.toString('base64')
      });
      if (ext === 'pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        pdfAttachmentCount += 1;
        pdfBytesTotal += got.buffer.length;
      }
    }

    const resolvedNoteId = Number(note.note_id);
    if (!Number.isFinite(resolvedNoteId) || resolvedNoteId < 1) {
      skipped.push({ noteId, reason: 'invalid_note_id' });
      continue;
    }

    const title = String(note.note_name || `Note ${resolvedNoteId}`);
    const textContent = String(expandRecordVaultBodyTextForSearch(note.body_text || '') || '').trim();
    if (!textContent && !attachments.length) {
      emptyBodyTitles.push(title);
    }

    notes.push({
      note_id: resolvedNoteId,
      title,
      // Match editor/search: unwrap v2 segmented bodies and strip HTML tags.
      text_content: textContent,
      attachments
    });
  }

  if (!notes.length) {
    const err = new Error('No readable notes found for the selected IDs.');
    err.code = 'RAG_NO_NOTES';
    throw err;
  }

  const hasAnyReadable = notes.some(
    (n) => String(n.text_content || '').trim() || (Array.isArray(n.attachments) && n.attachments.length)
  );
  if (!hasAnyReadable) {
    const listed = emptyBodyTitles.slice(0, 6).map((name) => `“${name}”`).join(', ');
    const more = emptyBodyTitles.length > 6 ? ` (+${emptyBodyTitles.length - 6} more)` : '';
    const err = new Error(
      `Selected notes have no saved body text${listed ? `: ${listed}${more}` : ''}. ` +
        'Type in the note editor and wait a moment for autosave (or click another note), ' +
        'or check the yellow RAG box on notes that already show saved content. ' +
        'Empty duplicate note names will not work.'
    );
    err.code = 'RAG_EMPTY_BODY';
    throw err;
  }

  return {
    notes,
    skipped,
    meta: {
      pdfAttachmentCount,
      pdfBytesTotal,
      emptyBodyTitles
    }
  };
}
