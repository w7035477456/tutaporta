/** Virtual system notebook / notes for TutaNotes Bill Schedule (not stored in vault SQLite). */

export const BILL_SCHEDULE_NOTEBOOK_ID = -900001;
export const BILL_MONTHLY_NOTE_ID = -900003;
export const BILL_YEARLY_NOTE_ID = -900002;
export const BILL_SUBSCRIPTION_NOTE_ID = -900004;
export const BILL_TODO_NOTE_ID = -900005;

export const BILL_SCHEDULE_NOTEBOOK_NAME = 'Bill Schedule';
export const BILL_MONTHLY_NOTE_NAME = 'Monthly';
export const BILL_YEARLY_NOTE_NAME = 'Yearly';
export const BILL_SUBSCRIPTION_NOTE_NAME = 'Subscription';
export const BILL_TODO_NOTE_NAME = 'ToDo';

export function isBillScheduleSystemId(id) {
  const n = Number(id);
  return (
    n === BILL_SCHEDULE_NOTEBOOK_ID ||
    n === BILL_MONTHLY_NOTE_ID ||
    n === BILL_YEARLY_NOTE_ID ||
    n === BILL_SUBSCRIPTION_NOTE_ID ||
    n === BILL_TODO_NOTE_ID
  );
}

export function isBillScheduleNotebookId(id) {
  return Number(id) === BILL_SCHEDULE_NOTEBOOK_ID;
}

export function isBillMonthlyNoteId(id) {
  return Number(id) === BILL_MONTHLY_NOTE_ID;
}

export function isBillYearlyNoteId(id) {
  return Number(id) === BILL_YEARLY_NOTE_ID;
}

export function isBillSubscriptionNoteId(id) {
  return Number(id) === BILL_SUBSCRIPTION_NOTE_ID;
}

export function isBillTodoNoteId(id) {
  return Number(id) === BILL_TODO_NOTE_ID;
}

/** Cross-pane drag kind for Bill Schedule notebook / Monthly / Yearly / Subscription. */
export function billScheduleCrossPaneKind(id) {
  if (isBillScheduleNotebookId(id)) return 'bill_schedule';
  if (isBillMonthlyNoteId(id)) return 'bill_monthly';
  if (isBillYearlyNoteId(id)) return 'bill_yearly';
  if (isBillSubscriptionNoteId(id)) return 'bill_subscription';
  // ToDo is local-only for now (no transferable table yet).
  return null;
}

export function isBillScheduleCrossPaneKind(kind) {
  return ['bill_schedule', 'bill_monthly', 'bill_yearly', 'bill_subscription'].includes(
    String(kind || '')
  );
}

/** True for a selectable vault note id or a Bill Schedule system note id. */
export function isSelectableNoteId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return false;
  if (n >= 1) return true;
  return (
    isBillMonthlyNoteId(n) ||
    isBillYearlyNoteId(n) ||
    isBillSubscriptionNoteId(n) ||
    isBillTodoNoteId(n)
  );
}

/** Max row-delete undos kept in memory (LIFO). */
export const BILL_SCHEDULE_DELETE_UNDO_MAX = 50;

/** Push a removed bill row onto the undo stack (last delete is undone first). */
export function pushBillRowDeleteUndo(stack, row, insertIndex) {
  const prev = Array.isArray(stack) ? stack : [];
  const next = [
    ...prev,
    {
      row: row && typeof row === 'object' ? { ...row } : row,
      insertIndex: Math.max(0, Math.trunc(Number(insertIndex)) || 0)
    }
  ];
  return next.length > BILL_SCHEDULE_DELETE_UNDO_MAX
    ? next.slice(next.length - BILL_SCHEDULE_DELETE_UNDO_MAX)
    : next;
}

/** Pop the most recent deleted row. */
export function popBillRowDeleteUndo(stack) {
  const prev = Array.isArray(stack) ? stack : [];
  if (!prev.length) return { stack: prev, entry: null };
  return { stack: prev.slice(0, -1), entry: prev[prev.length - 1] };
}

/** Re-insert a deleted row at its prior index and renumber #. */
export function restoreBillRowFromDeleteUndo(rows, entry) {
  const list = Array.isArray(rows) ? rows : [];
  if (!entry?.row || typeof entry.row !== 'object') return list;
  const idx = Math.max(0, Math.min(Number(entry.insertIndex) || 0, list.length));
  return [...list.slice(0, idx), { ...entry.row }, ...list.slice(idx)].map((r, i) => ({
    ...r,
    row_index: i + 1
  }));
}

/** Shared red × control at end of Bill Description rows. */
export const billScheduleRemoveRowBtnSx = {
  width: 24,
  height: 24,
  flexShrink: 0,
  border: '1px solid var(--theme-inverse-daynight-color)',
  bgcolor: '#e53935',
  color: '#fff',
  fontWeight: 900,
  fontSize: '0.85rem',
  lineHeight: 1,
  cursor: 'pointer',
  p: 0,
  borderRadius: 0.5
};

/** Green Approve control beside × on rows added by Auto Scan Emails. */
export const billScheduleApproveBtnSx = {
  height: 24,
  flexShrink: 0,
  px: 1,
  border: '1px solid #000',
  bgcolor: '#43a047',
  color: '#fff',
  fontWeight: 800,
  fontSize: '0.75rem',
  lineHeight: 1,
  cursor: 'pointer',
  borderRadius: 0.5,
  '&:hover': { filter: 'brightness(1.1)' },
  '&:disabled': { opacity: 0.5, cursor: 'default' }
};

/** Red dashed outline on Auto Scan rows until Approve is clicked. */
export const BILL_SCHEDULE_PENDING_ROW_STYLE = {
  outline: '3px dashed #e53935',
  outlineOffset: '-3px'
};

export function buildBillScheduleNotebook() {
  return {
    notebook_id: BILL_SCHEDULE_NOTEBOOK_ID,
    notebook_name: BILL_SCHEDULE_NOTEBOOK_NAME,
    is_system: true,
    is_bill_schedule: true,
    display_order: Number.MAX_SAFE_INTEGER,
    notes: [
      {
        note_id: BILL_MONTHLY_NOTE_ID,
        notebook_id: BILL_SCHEDULE_NOTEBOOK_ID,
        note_name: BILL_MONTHLY_NOTE_NAME,
        body_text: '',
        content_loaded: true,
        is_system: true,
        is_bill_schedule: true,
        display_order: 0
      },
      {
        note_id: BILL_YEARLY_NOTE_ID,
        notebook_id: BILL_SCHEDULE_NOTEBOOK_ID,
        note_name: BILL_YEARLY_NOTE_NAME,
        body_text: '',
        content_loaded: true,
        is_system: true,
        is_bill_schedule: true,
        display_order: 1
      },
      {
        note_id: BILL_SUBSCRIPTION_NOTE_ID,
        notebook_id: BILL_SCHEDULE_NOTEBOOK_ID,
        note_name: BILL_SUBSCRIPTION_NOTE_NAME,
        body_text: '',
        content_loaded: true,
        is_system: true,
        is_bill_schedule: true,
        display_order: 2
      },
      {
        note_id: BILL_TODO_NOTE_ID,
        notebook_id: BILL_SCHEDULE_NOTEBOOK_ID,
        note_name: BILL_TODO_NOTE_NAME,
        body_text: '',
        content_loaded: true,
        is_system: true,
        is_bill_schedule: true,
        display_order: 3
      }
    ]
  };
}
