/** Pure helpers for Bill Schedule tab labels in backup zip (no DB imports). */

export const DEFAULT_BILL_SCHEDULE_TAB_LABEL = 'home1';

function toIntOrNull(value) {
  if (value == null || value === '') return null;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : null;
}

/** Normalize tab name from backup JSON; empty → home1. */
export function normalizeBackupTabLabel(raw) {
  const s = String(raw ?? '')
    .trim()
    .slice(0, 64);
  return s || DEFAULT_BILL_SCHEDULE_TAB_LABEL;
}

function rowHasTabLabel(r) {
  return r != null && String(r.tab_label ?? '').trim() !== '';
}

/**
 * True when monthly/yearly rows lack tab_label and would collide on
 * (year, month, row_index) if everything were collapsed to home1.
 * Those backups were made before tabs were included in the zip.
 */
export function legacyBillScheduleTabsWouldCollapse(monthly, yearly) {
  const check = (rows, monthKey) => {
    const seen = new Set();
    for (const r of rows || []) {
      if (rowHasTabLabel(r)) continue;
      const y = toIntOrNull(r?.bill_year);
      const m = monthKey(r);
      const i = toIntOrNull(r?.row_index);
      if (y == null || m == null || i == null) continue;
      const key = `${y}|${m}|${i}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  };
  return (
    check(monthly, (r) => toIntOrNull(r?.bill_month)) ||
    check(yearly, (r) => toIntOrNull(r?.bill_month) ?? 0)
  );
}
