/** helloworldjunktest.requests paid columns (see be/db/renameRequestsPaidColumns.sql). */

export const REQUESTS_BRIEF_PAID_COLUMN = 'brief_paid';
export const REQUESTS_FULL_PAID_COLUMN = 'full_paid';
export const REQUESTS_BRIEF_PAID_DATE_COLUMN = 'brief_paid_date';
export const REQUESTS_FULL_PAID_DATE_COLUMN = 'full_paid_date';
export const REQUESTS_BRIEF_PAID_ENTRY_COLUMN = 'brief_paid_entry';
export const REQUESTS_FULL_PAID_ENTRY_COLUMN = 'full_paid_entry';

export function resolveBriefPaidColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_BRIEF_PAID_COLUMN) ? REQUESTS_BRIEF_PAID_COLUMN : null;
}

export function resolveFullPaidColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_FULL_PAID_COLUMN) ? REQUESTS_FULL_PAID_COLUMN : null;
}

export function resolveBriefPaidDateColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_BRIEF_PAID_DATE_COLUMN) ? REQUESTS_BRIEF_PAID_DATE_COLUMN : null;
}

export function resolveFullPaidDateColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_FULL_PAID_DATE_COLUMN) ? REQUESTS_FULL_PAID_DATE_COLUMN : null;
}

export function resolveBriefPaidEntryColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_BRIEF_PAID_ENTRY_COLUMN) ? REQUESTS_BRIEF_PAID_ENTRY_COLUMN : null;
}

export function resolveFullPaidEntryColumn(columnsSet) {
  return columnsSet?.has(REQUESTS_FULL_PAID_ENTRY_COLUMN) ? REQUESTS_FULL_PAID_ENTRY_COLUMN : null;
}
