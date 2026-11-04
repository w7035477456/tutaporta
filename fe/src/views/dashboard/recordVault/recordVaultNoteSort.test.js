import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX,
  RECORD_VAULT_NOTE_SORT_STEP_COUNT,
  loadStoredRecordVaultNoteSortIndex,
  nextRecordVaultNoteSortIndex,
  normalizeRecordVaultNoteSortIndex,
  recordVaultNoteSortButtonLabel,
  sortRecordVaultNotes,
  writeStoredRecordVaultNoteSortIndex
} from './recordVaultNoteSort';

const NOTES = [
  { note_id: 1, note_name: 'ZEBRA', created_at: '2026-01-03 10:00:00', updated_at: '2026-01-05 10:00:00' },
  { note_id: 2, note_name: 'apple', created_at: '2026-01-01 10:00:00', updated_at: '2026-01-09 10:00:00' },
  { note_id: 3, note_name: 'Mango', created_at: '2026-01-02 10:00:00', updated_at: '2026-01-04 10:00:00' }
];

const ids = (rows) => rows.map((row) => row.note_id);

describe('recordVaultNoteSort', () => {
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
    let index = RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX;
    const seen = [];
    for (let click = 0; click < RECORD_VAULT_NOTE_SORT_STEP_COUNT; click += 1) {
      seen.push(recordVaultNoteSortButtonLabel(index));
      index = nextRecordVaultNoteSortIndex(index);
    }
    expect(seen).toEqual(['Create ↓', 'Create ↑', 'Date ↓', 'Date ↑', 'Name ↓', 'Name ↑']);
    expect(index).toBe(RECORD_VAULT_NOTE_SORT_DEFAULT_INDEX);
    expect(recordVaultNoteSortButtonLabel(index)).toBe('Create ↓');
  });

  it('normalizes junk input to a valid step', () => {
    expect(normalizeRecordVaultNoteSortIndex(undefined)).toBe(0);
    expect(normalizeRecordVaultNoteSortIndex('nope')).toBe(0);
    expect(normalizeRecordVaultNoteSortIndex(-3)).toBe(0);
    expect(normalizeRecordVaultNoteSortIndex(6)).toBe(0);
    expect(normalizeRecordVaultNoteSortIndex('7')).toBe(1);
  });

  it('keeps the stored vault order for the default step (same reference)', () => {
    expect(sortRecordVaultNotes(NOTES, 0)).toBe(NOTES);
  });

  it('sorts newest created first, then oldest created first', () => {
    expect(ids(sortRecordVaultNotes(NOTES, 0))).toEqual([1, 2, 3]);
    expect(ids(sortRecordVaultNotes(NOTES, 1))).toEqual([2, 3, 1]);
  });

  it('sorts by last-edited date in both directions', () => {
    expect(ids(sortRecordVaultNotes(NOTES, 2))).toEqual([2, 1, 3]);
    expect(ids(sortRecordVaultNotes(NOTES, 3))).toEqual([3, 1, 2]);
  });

  it('sorts by name A→Z (A first) and Z→A (Z first), ignoring case', () => {
    expect(ids(sortRecordVaultNotes(NOTES, 4))).toEqual([2, 3, 1]);
    expect(ids(sortRecordVaultNotes(NOTES, 5))).toEqual([1, 3, 2]);
  });

  it('never mutates the stored array', () => {
    const copy = [...NOTES];
    sortRecordVaultNotes(NOTES, 4);
    expect(NOTES).toEqual(copy);
  });

  it('treats missing dates as oldest and tolerates non-array input', () => {
    const rows = [
      { note_id: 2, note_name: 'B', created_at: null },
      { note_id: 1, note_name: 'A', created_at: '2026-02-01 00:00:00' }
    ];
    expect(ids(sortRecordVaultNotes(rows, 1))).toEqual([2, 1]);
    expect(sortRecordVaultNotes(null, 4)).toEqual([]);
  });

  it('remembers the chosen step in localStorage', () => {
    expect(loadStoredRecordVaultNoteSortIndex()).toBe(0);
    writeStoredRecordVaultNoteSortIndex(4);
    expect(loadStoredRecordVaultNoteSortIndex()).toBe(4);
    writeStoredRecordVaultNoteSortIndex(99);
    expect(loadStoredRecordVaultNoteSortIndex()).toBe(99 % RECORD_VAULT_NOTE_SORT_STEP_COUNT);
  });
});
