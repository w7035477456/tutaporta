/**
 * Notebook-column order cycle for the "Add Notebook" header button.
 *
 * Same 6-step machine as the note-column toggle:
 *
 *   0  Create ↓   stored vault order — drag / created order
 *   1  Create ↑   oldest created notebook first
 *   2  Date ↓     most recently edited notebook first
 *   3  Date ↑     least recently edited notebook first
 *   4  Name ↓     titles A → Z
 *   5  Name ↑     titles Z → A
 *   6 → back to 0 (Create ↓)
 */

const SORT_STORAGE_KEY = 'recordVaultNotebookSortOrder_v1';

export const RECORD_VAULT_NOTEBOOK_SORT_ORDERS = [
  {
    id: 'create-desc',
    key: 'stored',
    dir: 'desc',
    label: 'Create',
    arrow: '↓',
    description: 'created order, newest notebook first'
  },
  {
    id: 'create-asc',
    key: 'created_at',
    dir: 'asc',
    label: 'Create',
    arrow: '↑',
    description: 'oldest created notebook first'
  },
  {
    id: 'date-desc',
    key: 'updated_at',
    dir: 'desc',
    label: 'Date',
    arrow: '↓',
    description: 'most recently edited notebook first'
  },
  {
    id: 'date-asc',
    key: 'updated_at',
    dir: 'asc',
    label: 'Date',
    arrow: '↑',
    description: 'least recently edited notebook first'
  },
  {
    id: 'name-asc',
    key: 'notebook_name',
    dir: 'asc',
    label: 'Name',
    arrow: '↓',
    description: 'title A first'
  },
  {
    id: 'name-desc',
    key: 'notebook_name',
    dir: 'desc',
    label: 'Name',
    arrow: '↑',
    description: 'title Z first'
  }
];

export const RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX = 0;
export const RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT = RECORD_VAULT_NOTEBOOK_SORT_ORDERS.length;

export function normalizeRecordVaultNotebookSortIndex(index) {
  const parsed = Number(index);
  if (!Number.isFinite(parsed) || parsed < 0) return RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX;
  return Math.trunc(parsed) % RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT;
}

export function nextRecordVaultNotebookSortIndex(index) {
  return (normalizeRecordVaultNotebookSortIndex(index) + 1) % RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT;
}

export function recordVaultNotebookSortOrder(index) {
  return RECORD_VAULT_NOTEBOOK_SORT_ORDERS[normalizeRecordVaultNotebookSortIndex(index)];
}

export function recordVaultNotebookSortButtonLabel(index) {
  const order = recordVaultNotebookSortOrder(index);
  return `${order.label} ${order.arrow}`;
}

export function recordVaultNotebookSortTitle(index) {
  const order = recordVaultNotebookSortOrder(index);
  const next = recordVaultNotebookSortOrder(nextRecordVaultNotebookSortIndex(index));
  return `Sorted by ${order.label} ${order.arrow} — ${order.description}. Click for ${next.label} ${next.arrow} — ${next.description}.`;
}

function recordVaultNotebookTimeMs(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const ms = Date.parse(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : 0;
}

function compareRecordVaultNotebooks(a, b, order) {
  if (order.key === 'notebook_name') {
    const cmp = String(a?.notebook_name ?? '').localeCompare(String(b?.notebook_name ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    return order.dir === 'asc' ? cmp : -cmp;
  }
  const diff = recordVaultNotebookTimeMs(a?.[order.key]) - recordVaultNotebookTimeMs(b?.[order.key]);
  return order.dir === 'asc' ? diff : -diff;
}

/**
 * Notebooks in the order selected by the header button. Step 0 returns the same
 * array reference so drag-and-drop order is preserved.
 */
export function sortRecordVaultNotebooks(notebooks, index) {
  const list = Array.isArray(notebooks) ? notebooks : [];
  const order = recordVaultNotebookSortOrder(index);
  if (order.key === 'stored') return list;
  return list
    .map((notebook, position) => ({ notebook, position }))
    .sort((a, b) => {
      const primary = compareRecordVaultNotebooks(a.notebook, b.notebook, order);
      if (primary) return primary;
      const byId = Number(a.notebook?.notebook_id ?? 0) - Number(b.notebook?.notebook_id ?? 0);
      if (byId) return byId;
      return a.position - b.position;
    })
    .map((entry) => entry.notebook);
}

export function loadStoredRecordVaultNotebookSortIndex() {
  try {
    return normalizeRecordVaultNotebookSortIndex(localStorage.getItem(SORT_STORAGE_KEY));
  } catch {
    return RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX;
  }
}

export function writeStoredRecordVaultNotebookSortIndex(index) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, String(normalizeRecordVaultNotebookSortIndex(index)));
  } catch {
    // private mode / quota — sorting still works for this session
  }
}

export const RECORD_VAULT_NOTEBOOK_SORT_STORAGE_KEY = SORT_STORAGE_KEY;
