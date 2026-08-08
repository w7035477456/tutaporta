import { stripPhotoAlbumsHtml } from 'utils/photoAlbumsRichText';

function plainNoteName(name) {
  return stripPhotoAlbumsHtml(name).trim();
}

export function formatDefaultPhotoAlbumsNotebookTitle(notebookNumber) {
  const n = Number(notebookNumber);
  if (!Number.isFinite(n) || n < 1) {
    return 'Set 1';
  }
  return `Set ${n}`;
}

/** User-entered album-set name on create (uppercase, max 120). */
export function normalizePhotoAlbumsNotebookCreateName(name) {
  return plainNoteName(name).trim().toUpperCase().slice(0, 120);
}

/** Combine album name + date for a new note title (uppercase name, keeps date text). */
export function buildPhotoAlbumsAlbumNoteName(name, dates = '') {
  const albumName = plainNoteName(name).trim().toUpperCase();
  const datePart = String(dates || '').trim();
  if (!albumName) return '';
  const combined = datePart ? `${albumName} ${datePart}` : albumName;
  return combined.trim().toUpperCase().slice(0, 120);
}

export function formatDefaultPhotoAlbumsNoteTitle(notebookNumber, noteNumber) {
  const nb = Number(notebookNumber);
  const nt = Number(noteNumber);
  if (!Number.isFinite(nb) || nb < 1 || !Number.isFinite(nt) || nt < 1) {
    return 'New Album';
  }
  return `Set ${nb}/Album ${nt}`;
}

const DEFAULT_NOTEBOOK_TITLE_RE = /^Set \d+$/i;
const LEGACY_NOTEBOOK_TITLE_RE = /^Notebook \d+$/i;

const DEFAULT_NOTE_TITLE_RE = /^Set \d+\/Album \d+$/i;
const LEGACY_NB_NOTE_TITLE_RE = /^NB \d+, Note \d+$/i;
const LEGACY_DEFAULT_NOTE_TITLE_RE = /^Default Title of Notebook \d+, Note \d+$/i;

export function isDefaultStylePhotoAlbumsNotebookTitle(name) {
  const plain = plainNoteName(name);
  return (
    DEFAULT_NOTEBOOK_TITLE_RE.test(plain) ||
    LEGACY_NOTEBOOK_TITLE_RE.test(plain) ||
    /^(new notebook)$/i.test(plain)
  );
}

export function isDefaultStylePhotoAlbumsNoteTitle(name) {
  const plain = plainNoteName(name);
  return (
    DEFAULT_NOTE_TITLE_RE.test(plain) ||
    LEGACY_NB_NOTE_TITLE_RE.test(plain) ||
    LEGACY_DEFAULT_NOTE_TITLE_RE.test(plain)
  );
}

export function isLegacyShortPhotoAlbumsNoteName(name) {
  return /^(new note|new album|note \d+|album \d+)$/i.test(plainNoteName(name));
}

export function notebookNumberFromList(notebooks, notebookId) {
  const idx = notebooks.findIndex((nb) => Number(nb.notebook_id) === Number(notebookId));
  return idx >= 0 ? idx + 1 : 1;
}

export function noteNumberFromList(notes, noteId) {
  const idx = notes.findIndex((n) => Number(n.note_id) === Number(noteId));
  return idx >= 0 ? idx + 1 : 1;
}

export function photoAlbumsNotebookSidebarLabel(notebook, notebooks = []) {
  const name = plainNoteName(notebook?.notebook_name);
  if (!isDefaultStylePhotoAlbumsNotebookTitle(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, notebook?.notebook_id);
  return formatDefaultPhotoAlbumsNotebookTitle(nbNum);
}

export function resolvePhotoAlbumsNoteTitle(note, notebooks, notes) {
  const raw = String(note?.note_name ?? '').trim();
  const name = plainNoteName(raw);
  if (isDefaultStylePhotoAlbumsNoteTitle(name)) {
    const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
    const noteNum = noteNumberFromList(notes, note?.note_id);
    return formatDefaultPhotoAlbumsNoteTitle(nbNum, noteNum);
  }
  if (!name || isLegacyShortPhotoAlbumsNoteName(name)) {
    const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
    const noteNum = noteNumberFromList(notes, note?.note_id);
    return formatDefaultPhotoAlbumsNoteTitle(nbNum, noteNum);
  }
  return raw;
}

export function photoAlbumsNoteSidebarLabel(note, notes, notebooks = []) {
  const name = plainNoteName(note?.note_name);
  if (!isDefaultStylePhotoAlbumsNoteTitle(name) && !isLegacyShortPhotoAlbumsNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, note?.notebook_id);
  const noteNum = noteNumberFromList(notes, note?.note_id);
  return formatDefaultPhotoAlbumsNoteTitle(nbNum, noteNum);
}

/** Note row label — live title only for the note currently open in the editor. */
export function photoAlbumsNoteMenuLabel(
  note,
  notes,
  { selectedNoteId = null, openNoteTitlePlain = '', notebooks = [] } = {}
) {
  const stored = photoAlbumsNoteSidebarLabel(note, notes, notebooks);
  if (selectedNoteId != null && Number(note?.note_id) === Number(selectedNoteId)) {
    const live = plainNoteName(openNoteTitlePlain);
    return live || stored;
  }
  return stored;
}

/** Shortcut row label — resolves from the linked note; live title when that note is open. */
export function photoAlbumsShortcutMenuLabel(
  shortcut,
  { selectedNoteId = null, openNoteTitlePlain = '', notebooks = [] } = {}
) {
  if (shortcut?.target_type === 'notebook') {
    const notebook = notebooks.find((nb) => Number(nb.notebook_id) === Number(shortcut.notebook_id));
    if (notebook) {
      return photoAlbumsNotebookSidebarLabel(notebook, notebooks);
    }
    return String(shortcut?.label ?? '').trim() || 'Shortcut';
  }
  const notebook = notebooks.find((nb) => Number(nb.notebook_id) === Number(shortcut.notebook_id));
  const notes = notebook?.notes || [];
  const note = notes.find((n) => Number(n.note_id) === Number(shortcut.note_id));
  if (note) {
    const stored = photoAlbumsNoteSidebarLabel(note, notes, notebooks);
    if (selectedNoteId != null && Number(note.note_id) === Number(selectedNoteId)) {
      const live = plainNoteName(openNoteTitlePlain);
      return live || stored;
    }
    return stored;
  }
  const name = plainNoteName(shortcut?.label);
  if (!isDefaultStylePhotoAlbumsNoteTitle(name) && !isLegacyShortPhotoAlbumsNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, shortcut.notebook_id);
  const noteNum = noteNumberFromList(notes, shortcut.note_id);
  return formatDefaultPhotoAlbumsNoteTitle(nbNum, noteNum);
}

/** Tab label in the Record Vault search results bar. */
export function photoAlbumsSearchResultTabLabel(note, notebook, notebooks, notesInNotebook) {
  const name = plainNoteName(note?.note_name);
  if (!isDefaultStylePhotoAlbumsNoteTitle(name) && !isLegacyShortPhotoAlbumsNoteName(name) && name) {
    return name;
  }
  const nbNum = notebookNumberFromList(notebooks, notebook?.notebook_id ?? note?.notebook_id);
  const noteNum = noteNumberFromList(notesInNotebook, note?.note_id);
  return formatDefaultPhotoAlbumsNoteTitle(nbNum, noteNum);
}
