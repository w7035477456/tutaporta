const STORAGE_KEY = 'recordVaultRecentNotes_v1';
const MAX_STORED = 50;

export function recordVaultRecentScopeKey(storageType, singlesId) {
  const st = String(storageType || 'usb').trim() || 'usb';
  const sid = Number(singlesId);
  return `${st}:${Number.isFinite(sid) && sid > 0 ? sid : 0}`;
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // quota or private mode
  }
}

/** @returns {Record<string, { notebookId: number, title: string, updatedAt: number }>} */
export function readRecordVaultRecentActivity(scopeKey) {
  const scope = String(scopeKey || '');
  if (!scope) return {};
  const bucket = readAll()[scope];
  if (!bucket || typeof bucket !== 'object') return {};
  return bucket;
}

export function touchRecordVaultRecentNote(scopeKey, { noteId, notebookId, title, at = Date.now() }) {
  const id = Number(noteId);
  const nbId = Number(notebookId);
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(nbId) || nbId < 1) return;
  const scope = String(scopeKey || '');
  if (!scope) return;
  const all = readAll();
  const bucket = { ...(all[scope] || {}) };
  bucket[String(id)] = {
    notebookId: nbId,
    title: String(title || '').trim(),
    updatedAt: Number(at) || Date.now()
  };
  const keys = Object.keys(bucket);
  if (keys.length > MAX_STORED) {
    keys
      .sort((a, b) => (bucket[a].updatedAt || 0) - (bucket[b].updatedAt || 0))
      .slice(0, keys.length - MAX_STORED)
      .forEach((key) => delete bucket[key]);
  }
  all[scope] = bucket;
  writeAll(all);
}

export function removeRecordVaultRecentNote(scopeKey, noteId) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return;
  const scope = String(scopeKey || '');
  if (!scope) return;
  const all = readAll();
  const bucket = all[scope];
  if (!bucket || !(String(id) in bucket)) return;
  const next = { ...bucket };
  delete next[String(id)];
  all[scope] = next;
  writeAll(all);
}

export function noteVaultTimestampMs(note) {
  const raw = note?.updated_at || note?.created_at;
  if (!raw) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const normalized = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Up to `limit` recent notes (newest first). Merges local activity with vault `updated_at`.
 * @returns {Array<{ note_id: number, notebook_id: number, label: string, sortMs: number } | null>}
 */
export function buildRecordVaultRecentNoteSlots({
  notebooks,
  scopeKey,
  limit = 5,
  isExcluded = () => false,
  getLabel = (note) => String(note?.note_name || '').trim() || 'Note'
}) {
  const activity = readRecordVaultRecentActivity(scopeKey);
  const candidates = [];
  for (const notebook of notebooks || []) {
    const nbId = Number(notebook.notebook_id);
    const notesInNotebook = notebook.notes || [];
    for (const note of notesInNotebook) {
      const noteId = Number(note.note_id);
      if (!Number.isFinite(noteId) || noteId < 1) continue;
      if (isExcluded(note, notesInNotebook, notebook)) continue;
      const act = activity[String(noteId)];
      const sortMs = Math.max(act?.updatedAt || 0, noteVaultTimestampMs(note));
      if (sortMs <= 0 && !act) continue;
      candidates.push({
        note_id: noteId,
        notebook_id: nbId,
        label: getLabel(note, notebook, notesInNotebook) || act?.title || 'Note',
        sortMs
      });
    }
  }
  candidates.sort((a, b) => b.sortMs - a.sortMs || a.note_id - b.note_id);
  const picked = candidates.slice(0, limit);
  const slots = [];
  for (let i = 0; i < limit; i += 1) {
    slots.push(picked[i] || null);
  }
  return slots;
}
