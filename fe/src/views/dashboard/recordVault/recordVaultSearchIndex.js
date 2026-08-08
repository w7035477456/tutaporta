const INDEX_KEY = 'recordVaultNoteSearchIndex_v1';
const MAX_ENTRIES = 500;

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // quota or private mode — ignore
  }
}

/** Store plain searchable text for a note (content editor supplies the text). */
export function indexNoteSearchText(noteId, text, title = '') {
  if (!noteId) return;
  const id = String(noteId);
  const index = readIndex();
  index[id] = {
    title: String(title || ''),
    text: String(text || ''),
    updatedAt: Date.now()
  };
  const keys = Object.keys(index);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (index[a].updatedAt || 0) - (index[b].updatedAt || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete index[key]);
  }
  writeIndex(index);
}

export function searchIndexedNotes(query, { noteIds = null, excludeNoteIds = null } = {}) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  const index = readIndex();
  const out = [];
  for (const [noteId, entry] of Object.entries(index)) {
    const id = Number(noteId);
    if (noteIds && !noteIds.has(id)) continue;
    if (excludeNoteIds && excludeNoteIds.has(id)) continue;
    const hay = `${entry.title} ${entry.text}`.toLowerCase();
    if (hay.includes(q)) {
      out.push({ noteId: id, ...entry });
    }
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Drop cached plaintext so locked notes cannot surface in local search. */
export function removeNoteSearchIndex(noteId) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return;
  const index = readIndex();
  if (!(String(id) in index)) return;
  delete index[String(id)];
  writeIndex(index);
}

export function getIndexedNoteText(noteId) {
  return readIndex()[String(noteId)] || null;
}
