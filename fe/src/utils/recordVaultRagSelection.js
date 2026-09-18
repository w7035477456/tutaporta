const LS_PREFIX = 'recordVaultRagNoteIds';

function storageKey(storageType, singlesId) {
  const st = String(storageType || 'usb').toLowerCase();
  const sid = Number(singlesId);
  return `${LS_PREFIX}:${st}:${Number.isFinite(sid) && sid > 0 ? sid : 'anon'}`;
}

export function loadRecordVaultRagSelection(storageType, singlesId) {
  try {
    const raw = sessionStorage.getItem(storageKey(storageType, singlesId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  } catch {
    return [];
  }
}

export function saveRecordVaultRagSelection(storageType, singlesId, noteIds) {
  const ids = [...new Set((noteIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  try {
    sessionStorage.setItem(storageKey(storageType, singlesId), JSON.stringify(ids));
  } catch {
    // ignore quota errors
  }
  return ids;
}

export function toggleRecordVaultRagSelection(storageType, singlesId, noteId, selected) {
  const id = Number(noteId);
  const current = loadRecordVaultRagSelection(storageType, singlesId);
  const next = selected
    ? [...new Set([...current, id])]
    : current.filter((entry) => Number(entry) !== id);
  return saveRecordVaultRagSelection(storageType, singlesId, next);
}
