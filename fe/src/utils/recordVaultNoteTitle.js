import { stripRecordVaultHtml } from 'utils/recordVaultRichText';

function plainNoteName(name) {
  return stripRecordVaultHtml(name).trim();
}

export function formatDefaultRecordVaultNoteTitle(notebookNumber, noteNumber) {
  const nb = Number(notebookNumber);
  const nt = Number(noteNumber);
  if (!Number.isFinite(nb) || nb < 1 || !Number.isFinite(nt) || nt < 1) {
    return 'New Note';
  }
  return `NB ${nb}, Note ${nt}`;
}

const DEFAULT_NOTE_TITLE_RE = /^NB \d+, Note \d+$/i;
const LEGACY_DEFAULT_NOTE_TITLE_RE = /^Default Title of Notebook \d+, Note \d+$/i;

export function isDefaultStyleRecordVaultNoteTitle(name) {
  const plain = plainNoteName(name);
  return DEFAULT_NOTE_TITLE_RE.test(plain) || LEGACY_DEFAULT_NOTE_TITLE_RE.test(plain);
}

export function isLegacyShortRecordVaultNoteName(name) {
  return /^(new note|note \d+)$/i.test(plainNoteName(name));
}

export function notebookNumberFromList(notebooks, notebookId) {
  const idx = notebooks.findIndex((nb) => Number(nb.notebook_id) === Number(notebookId));
  return idx >= 0 ? idx + 1 : 1;
}

export function noteNumberFromList(notes, noteId) {
  const idx = notes.findIndex((n) => Number(n.note_id) === Number(noteId));
  return idx >= 0 ? idx + 1 : 1;
}

export function resolveRecordVaultNoteTitle(note, notebooks, notes) {
  const raw = String(note?.note_name ?? '').trim();
  const name = plainNoteName(raw);
  if (isDefaultStyleRecordVaultNoteTitle(name)) {
    const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
    const noteNum = noteNumberFromList(notes, note?.note_id);
    return formatDefaultRecordVaultNoteTitle(nbNum, noteNum);
  }
  if (!name || isLegacyShortRecordVaultNoteName(name)) {
    const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
    const noteNum = noteNumberFromList(notes, note?.note_id);
    return formatDefaultRecordVaultNoteTitle(nbNum, noteNum);
  }
  return raw;
}

export function recordVaultNoteSidebarLabel(note, notes, notebooks = []) {
  const name = plainNoteName(note?.note_name);
  if (!isDefaultStyleRecordVaultNoteTitle(name) && !isLegacyShortRecordVaultNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
  const noteNum = noteNumberFromList(notes, note?.note_id);
  return formatDefaultRecordVaultNoteTitle(nbNum, noteNum);
}

/** Note row label — live title only for the note currently open in the editor. */
export function recordVaultNoteMenuLabel(
  note,
  notes,
  { selectedNoteId = null, openNoteTitlePlain = '', notebooks = [] } = {}
) {
  const stored = recordVaultNoteSidebarLabel(note, notes, notebooks);
  if (selectedNoteId != null && Number(note?.note_id) === Number(selectedNoteId)) {
    const live = plainNoteName(openNoteTitlePlain);
    return live || stored;
  }
  return stored;
}

/** Shortcut row label — resolves from the linked note; live title when that note is open. */
export function recordVaultShortcutMenuLabel(
  shortcut,
  { selectedNoteId = null, openNoteTitlePlain = '', notebooks = [] } = {}
) {
  if (shortcut?.target_type === 'notebook') {
    return String(shortcut?.label ?? '').trim() || 'Shortcut';
  }
  const notebook = notebooks.find((nb) => Number(nb.notebook_id) === Number(shortcut.notebook_id));
  const notes = notebook?.notes || [];
  const note = notes.find((n) => Number(n.note_id) === Number(shortcut.note_id));
  if (note) {
    const stored = recordVaultNoteSidebarLabel(note, notes, notebooks);
    if (selectedNoteId != null && Number(note.note_id) === Number(selectedNoteId)) {
      const live = plainNoteName(openNoteTitlePlain);
      return live || stored;
    }
    return stored;
  }
  const name = plainNoteName(shortcut?.label);
  if (!isDefaultStyleRecordVaultNoteTitle(name) && !isLegacyShortRecordVaultNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, shortcut.notebook_id);
  const noteNum = noteNumberFromList(notes, shortcut.note_id);
  return formatDefaultRecordVaultNoteTitle(nbNum, noteNum);
}

/** Tab label in the Record Vault search results bar. */
export function recordVaultSearchResultTabLabel(note, notebook, notebooks, notesInNotebook) {
  const name = plainNoteName(note?.note_name);
  if (!isDefaultStyleRecordVaultNoteTitle(name) && !isLegacyShortRecordVaultNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, notebook?.notebook_id ?? note?.notebook_id);
  const noteNum = noteNumberFromList(notesInNotebook, note?.note_id);
  return formatDefaultRecordVaultNoteTitle(nbNum, noteNum);
}
