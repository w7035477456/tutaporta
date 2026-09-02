/** Virtual system notebook / notes for TutaNotes Bill Schedule (not stored in vault SQLite). */

export const BILL_SCHEDULE_NOTEBOOK_ID = -900001;
export const BILL_MONTHLY_NOTE_ID = -900003;
export const BILL_YEARLY_NOTE_ID = -900002;

export const BILL_SCHEDULE_NOTEBOOK_NAME = 'Bill Schedule';
export const BILL_MONTHLY_NOTE_NAME = 'Monthly';
export const BILL_YEARLY_NOTE_NAME = 'Yearly';

export function isBillScheduleSystemId(id) {
  const n = Number(id);
  return (
    n === BILL_SCHEDULE_NOTEBOOK_ID ||
    n === BILL_MONTHLY_NOTE_ID ||
    n === BILL_YEARLY_NOTE_ID
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

/** Cross-pane drag kind for Bill Schedule notebook / Monthly / Yearly. */
export function billScheduleCrossPaneKind(id) {
  if (isBillScheduleNotebookId(id)) return 'bill_schedule';
  if (isBillMonthlyNoteId(id)) return 'bill_monthly';
  if (isBillYearlyNoteId(id)) return 'bill_yearly';
  return null;
}

export function isBillScheduleCrossPaneKind(kind) {
  return ['bill_schedule', 'bill_monthly', 'bill_yearly'].includes(String(kind || ''));
}

/** True for a selectable vault note id or a Bill Schedule system note id. */
export function isSelectableNoteId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return false;
  if (n >= 1) return true;
  return isBillMonthlyNoteId(n) || isBillYearlyNoteId(n);
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
      }
    ]
  };
}
