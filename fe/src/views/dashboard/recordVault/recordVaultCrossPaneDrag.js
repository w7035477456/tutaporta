/** Shared MIME + in-memory payload for Cloud↔USB notebook/note drag (getData is unreliable mid-drag). */

export const DRAG_CROSS_PANE = 'application/x-record-vault-cross-pane';

export const RECORD_VAULT_TREE_RELOAD_EVENT = 'record-vault-tree-reload';

let activeCrossPaneDrag = null;
/** Set when a foreign pane accepts the drop — source dragend must not offer Finder HTML export. */
let crossPaneDropConsumed = false;

export function setActiveCrossPaneDrag(payload) {
  activeCrossPaneDrag = payload && typeof payload === 'object' ? { ...payload } : null;
  crossPaneDropConsumed = false;
}

export function getActiveCrossPaneDrag() {
  return activeCrossPaneDrag;
}

export function clearActiveCrossPaneDrag() {
  activeCrossPaneDrag = null;
}

/** Destination pane accepted Cloud↔USB transfer — skip notebook/note HTML export on source dragend. */
export function markCrossPaneDropConsumed() {
  crossPaneDropConsumed = true;
}

export function takeCrossPaneDropConsumed() {
  const taken = crossPaneDropConsumed;
  crossPaneDropConsumed = false;
  return taken;
}

export function serializeCrossPaneDrag(payload) {
  try {
    return JSON.stringify(payload || {});
  } catch {
    return '';
  }
}

export function parseCrossPaneDrag(raw) {
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') return null;
    const storageType = String(data.storageType || '').toLowerCase() === 'onedrive' ? 'onedrive' : 'usb';
    const kind = data.kind === 'notebook' ? 'notebook' : data.kind === 'note' ? 'note' : null;
    if (!kind) return null;
    const id = Number(data.id);
    if (!Number.isFinite(id) || id < 1) return null;
    return {
      kind,
      id,
      storageType,
      name: String(data.name || '').trim(),
      notebookId: data.notebookId != null ? Number(data.notebookId) : null
    };
  } catch {
    return null;
  }
}

export function readCrossPaneDragFromEvent(event) {
  const fromMemory = getActiveCrossPaneDrag();
  if (fromMemory) return fromMemory;
  try {
    const raw =
      event?.dataTransfer?.getData?.(DRAG_CROSS_PANE) ||
      event?.dataTransfer?.getData?.('application/json') ||
      '';
    return parseCrossPaneDrag(raw);
  } catch {
    return null;
  }
}

export function isForeignCrossPaneDrag(event, paneStorageType) {
  const drag = readCrossPaneDragFromEvent(event);
  if (!drag) return false;
  const pane = String(paneStorageType || '').toLowerCase() === 'onedrive' ? 'onedrive' : 'usb';
  return drag.storageType !== pane;
}

export function notifyRecordVaultTreeReload(storageType) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RECORD_VAULT_TREE_RELOAD_EVENT, {
      detail: { storageType: storageType || null }
    })
  );
}

export function namesEqualIgnoreCase(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
