import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  buildRecordVaultRecentNoteSlots,
  recordVaultRecentScopeKey,
  touchRecordVaultRecentNote
} from './recordVaultRecentNotes';

describe('recordVaultRecentNotes', () => {
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

  it('orders by latest activity and fills five slots', () => {
    const scope = recordVaultRecentScopeKey('usb', 42);
    const notebooks = [
      {
        notebook_id: 1,
        notebook_name: 'A',
        notes: [
          { note_id: 10, note_name: 'OLD', updated_at: '2020-01-01 00:00:00' },
          { note_id: 11, note_name: 'NEW', updated_at: '2026-01-01 00:00:00' }
        ]
      }
    ];
    touchRecordVaultRecentNote(scope, { noteId: 10, notebookId: 1, title: 'OLD', at: 9_000_000_000_000 });
    const slots = buildRecordVaultRecentNoteSlots({
      notebooks,
      scopeKey: scope,
      limit: 5,
      getLabel: (n) => n.note_name
    });
    expect(slots[0]?.note_id).toBe(10);
    expect(slots[1]?.note_id).toBe(11);
    expect(slots.filter(Boolean)).toHaveLength(2);
    expect(slots).toHaveLength(5);
  });
});
