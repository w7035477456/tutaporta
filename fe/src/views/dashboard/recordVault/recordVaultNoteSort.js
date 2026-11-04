/**
 * Note-column order cycle for the "Add Note" header button.
 *
 * One click advances one step and the 6th click wraps back to the default, so the
 * button carries the whole state machine:
 *
 *   0  Create ↓   stored vault order — the order the notes were created, newest first
 *   1  Create ↑   oldest created note first
 *   2  Date ↓     most recently edited note first
 *   3  Date ↑     least recently edited note first
 *   4  Name ↓     titles A → Z (A first)
 *   5  Name ↑     titles Z → A (Z first)
 *   6 → back to 0 (Create ↓)
 *
 * Step 0 keeps the drag-and-drop order untouched; every other step is a stable
 * sort on top of it.
 */

const SORT_STORAGE_KEY = 'recordVaultNoteSortOrder_v1';

/** Order steps, in click order. `key: 'stored'` keeps the vault (created) order. */
export const RECORD_VAULT_NOTE_SORT_ORDERS = [
  {
    id: 'create-desc',
    key: 'stored',
    dir: 'desc',
    label: 'Create',
    arrow: '↓',
    description: 'created order, newest note first'
  },
  {
    id: 'create-asc',
    key: 'created_at',
    dir: 'asc',
    label: 'Create',
    arrow: '↑',
    description: 'oldest created note first'
  },
  {
    id: 'date-desc',
    key: 'updated_at',
    dir: 'desc',
    label: 'Date',
    arrow: '↓',
    description: 'most recently edited note first'
  },
  {
    id: 'date-asc',
    key: 'updated_at',
    dir: 'asc',
    label: 'Date',
    arrow: '↑',
    description: 'least recently edited note first'
  },
  {
    id: 'name-asc',
    key: 'note_name',
    dir: 'asc',
    label: 'Name',
    arrow: '↓',
    description: 'title A first'
  },
  {
    id: 'name-desc',
    key: 'note_name',
    dir: 'desc',
    label: 'Name',
    arrow: '↑',
    description: 'title Z first'
  }
];

export const RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX = 0;
export const RECORD_VAULT_NOTE_SORT_STEP_COUNT = RECORD_VAULT_NOTE_SORT_ORDERS.length;

/** Coerce anything (stale localStorage, NaN, out of range) into a valid step. */
export function normalizeRecordVaultNoteSortIndex(index) {
  const parsed = Number(index);
  if (!Number.isFinite(parsed) || parsed < 0) return RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX;
  return Math.trunc(parsed) % RECORD_VAULT_NOTE_SORT_STEP_COUNT;
}

/** Next step in the 6-order cycle (the 6th click wraps back to the default). */
export function nextRecordVaultNoteSortIndex(index) {
  return (normalizeRecordVaultNoteSortIndex(index) + 1) % RECORD_VAULT_NOTE_SORT_STEP_COUNT;
}

export function recordVaultNoteSortOrder(index) {
  return RECORD_VAULT_NOTE_SORT_ORDERS[normalizeRecordVaultNoteSortIndex(index)];
}

/** Button caption, e.g. "Create ↓" / "Name ↑". */
export function recordVaultNoteSortButtonLabel(index) {
  const order = recordVaultNoteSortOrder(index);
  return `${order.label} ${order.arrow}`;
}

/** Hover text: what the current order means + what the next click will show. */
export function recordVaultNoteSortTitle(index) {
  const order = recordVaultNoteSortOrder(index);
  const next = recordVaultNoteSortOrder(nextRecordVaultNoteSortIndex(index));
  return `Sorted by ${order.label} ${order.arrow} — ${order.description}. Click for ${next.label} ${next.arrow} — ${next.description}.`;
}

/**
 * SQLite hands us `YYYY-MM-DD HH:MM:SS`; `Date.parse` on that form is not
 * portable, so convert the space to `T` first. Unparseable / missing = oldest.
 */
function recordVaultNoteTimeMs(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const ms = Date.parse(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : 0;
}

function compareRecordVaultNotes(a, b, order) {
  if (order.key === 'note_name') {
    const cmp = String(a?.note_name ?? '').localeCompare(String(b?.note_name ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    return order.dir === 'asc' ? cmp : -cmp;
  }
  const diff = recordVaultNoteTimeMs(a?.[order.key]) - recordVaultNoteTimeMs(b?.[order.key]);
  return order.dir === 'asc' ? diff : -diff;
}

/**
 * Notes in the order selected by the header button. Step 0 returns the very same
 * array reference so manual drag-and-drop order is preserved; every other step
 * sorts stably — ties keep vault position, then note_id.
 */
export function sortRecordVaultNotes(notes, index) {
  const list = Array.isArray(notes) ? notes : [];
  const order = recordVaultNoteSortOrder(index);
  if (order.key === 'stored') return list;
  return list
    .map((note, position) => ({ note, position }))
    .sort((a, b) => {
      const primary = compareRecordVaultNotes(a.note, b.note, order);
      if (primary) return primary;
      const byId = Number(a.note?.note_id ?? 0) - Number(b.note?.note_id ?? 0);
      if (byId) return byId;
      return a.position - b.position;
    })
    .map((entry) => entry.note);
}

export function loadStoredRecordVaultNoteSortIndex() {
  try {
    return normalizeRecordVaultNoteSortIndex(localStorage.getItem(SORT_STORAGE_KEY));
  } catch {
    return RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX;
  }
}

export function writeStoredRecordVaultNoteSortIndex(index) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, String(normalizeRecordVaultNoteSortIndex(index)));
  } catch {
    // private mode / quota — sorting still works for this session
  }
}

export const RECORD_VAULT_NOTE_SORT_STORAGE_KEY = SORT_STORAGE_KEY;
