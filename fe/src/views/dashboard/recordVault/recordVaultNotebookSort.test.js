import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX,
  RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT,
  loadStoredRecordVaultNotebookSortIndex,
  nextRecordVaultNotebookSortIndex,
  normalizeRecordVaultNotebookSortIndex,
  recordVaultNotebookSortButtonLabel,
  sortRecordVaultNotebooks,
  writeStoredRecordVaultNotebookSortIndex
} from './recordVaultNotebookSort';

const NOTEBOOKS = [
  { notebook_id: 1, notebook_name: 'ZEBRA', created_at: '2026-01-03 10:00:00', updated_at: '2026-01-05 10:00:00' },
  { notebook_id: 2, notebook_name: 'apple', created_at: '2026-01-01 10:00:00', updated_at: '2026-01-09 10:00:00' },
  { notebook_id: 3, notebook_name: 'Mango', created_at: '2026-01-02 10:00:00', updated_at: '2026-01-04 10:00:00' }
];

const ids = (rows) => rows.map((row) => row.notebook_id);

describe('recordVaultNotebookSort', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }
    });
  });

  it('cycles six steps and wraps to the default on the 6th click', () => {
    let index = RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX;
    const seen = [];
    for (let click = 0; click < RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT; click += 1) {
      seen.push(recordVaultNotebookSortButtonLabel(index));
      index = nextRecordVaultNotebookSortIndex(index);
    }
    expect(seen).toEqual(['Create ↓', 'Create ↑', 'Date ↓', 'Date ↑', 'Name ↓', 'Name ↑']);
    expect(index).toBe(RECORD_VAULT_NOTEBOOK_SORT_DEFAULT_INDEX);
    expect(recordVaultNotebookSortButtonLabel(index)).toBe('Create ↓');
  });

  it('normalizes junk input to a valid step', () => {
    expect(normalizeRecordVaultNotebookSortIndex(undefined)).toBe(0);
    expect(normalizeRecordVaultNotebookSortIndex('nope')).toBe(0);
    expect(normalizeRecordVaultNotebookSortIndex(-3)).toBe(0);
    expect(normalizeRecordVaultNotebookSortIndex(6)).toBe(0);
    expect(normalizeRecordVaultNotebookSortIndex('7')).toBe(1);
  });

  it('keeps the stored vault order for the default step (same reference)', () => {
    expect(sortRecordVaultNotebooks(NOTEBOOKS, 0)).toBe(NOTEBOOKS);
  });

  it('sorts newest created first, then oldest created first', () => {
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 0))).toEqual([1, 2, 3]);
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 1))).toEqual([2, 3, 1]);
  });

  it('sorts by last-edited date in both directions', () => {
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 2))).toEqual([2, 1, 3]);
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 3))).toEqual([3, 1, 2]);
  });

  it('sorts by name A→Z (A first) and Z→A (Z first), ignoring case', () => {
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 4))).toEqual([2, 3, 1]);
    expect(ids(sortRecordVaultNotebooks(NOTEBOOKS, 5))).toEqual([1, 3, 2]);
  });

  it('never mutates the stored array', () => {
    const copy = [...NOTEBOOKS];
    sortRecordVaultNotebooks(NOTEBOOKS, 4);
    expect(NOTEBOOKS).toEqual(copy);
  });

  it('treats missing dates as oldest and tolerates non-array input', () => {
    const rows = [
      { notebook_id: 2, notebook_name: 'B', created_at: null },
      { notebook_id: 1, notebook_name: 'A', created_at: '2026-02-01 00:00:00' }
    ];
    expect(ids(sortRecordVaultNotebooks(rows, 1))).toEqual([2, 1]);
    expect(sortRecordVaultNotebooks(null, 4)).toEqual([]);
  });

  it('remembers the chosen step in localStorage', () => {
    expect(loadStoredRecordVaultNotebookSortIndex()).toBe(0);
    writeStoredRecordVaultNotebookSortIndex(4);
    expect(loadStoredRecordVaultNotebookSortIndex()).toBe(4);
    writeStoredRecordVaultNotebookSortIndex(99);
    expect(loadStoredRecordVaultNotebookSortIndex()).toBe(99 % RECORD_VAULT_NOTEBOOK_SORT_STEP_COUNT);
  });
});
