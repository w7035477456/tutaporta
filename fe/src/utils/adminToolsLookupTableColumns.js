const SINGLES_STORAGE_KEY = 'adminToolsLookupSinglesColWidths_v8';
const AUDIT_STORAGE_KEY = 'adminToolsLookupAuditColWidths_v1';

/** Desktop column widths (px); Photo, Alias…member_id, Email, Impersonate, status, Tokens, … Age. */
export const DEFAULT_SINGLES_COLUMN_WIDTHS_PX = Object.freeze([
  56, 128, 92, 112, 240, 128, 124, 88, 168, 48, 120, 100, 140, 220, 108
]);
export const DEFAULT_AUDIT_COLUMN_WIDTHS_PX = Object.freeze([48, 92, 96, 260, 240, 168]);

export const MIN_SINGLES_COLUMN_WIDTHS_PX = Object.freeze([
  52, 96, 100, 100, 160, 120, 100, 80, 120, 96, 110, 130, 110, 140, 100
]);
export const MIN_AUDIT_COLUMN_WIDTHS_PX = Object.freeze([48, 64, 72, 140, 120, 100]);

export function sumLookupColumnWidths(widths) {
  return widths.reduce((total, width) => total + Math.max(0, Number(width) || 0), 0);
}

export function buildLookupGridTemplateColumns(widths) {
  const desktop = widths.map((width) => `${Math.max(0, Math.trunc(width))}px`).join(' ');
  return {
    xs: '36px 1fr',
    sm: desktop
  };
}

function clampWidths(widths, defaults, mins) {
  return defaults.map((fallback, index) => {
    const raw = Number(widths?.[index]);
    const min = mins[index] ?? 48;
    const value = Number.isFinite(raw) && raw > 0 ? raw : fallback;
    return Math.max(min, Math.trunc(value));
  });
}

function readStoredWidths(storageKey, defaults, mins) {
  if (typeof window === 'undefined') return [...defaults];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaults];
    return clampWidths(parsed, defaults, mins);
  } catch {
    return [...defaults];
  }
}

export function writeStoredLookupColumnWidths(storageKey, widths) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // ignore quota / private mode
  }
}

export function readInitialSinglesColumnWidths() {
  return readStoredWidths(SINGLES_STORAGE_KEY, DEFAULT_SINGLES_COLUMN_WIDTHS_PX, MIN_SINGLES_COLUMN_WIDTHS_PX);
}

export function readInitialAuditColumnWidths() {
  return readStoredWidths(AUDIT_STORAGE_KEY, DEFAULT_AUDIT_COLUMN_WIDTHS_PX, MIN_AUDIT_COLUMN_WIDTHS_PX);
}

export function clampSinglesColumnWidths(widths) {
  return clampWidths(widths, DEFAULT_SINGLES_COLUMN_WIDTHS_PX, MIN_SINGLES_COLUMN_WIDTHS_PX);
}

export function clampAuditColumnWidths(widths) {
  return clampWidths(widths, DEFAULT_AUDIT_COLUMN_WIDTHS_PX, MIN_AUDIT_COLUMN_WIDTHS_PX);
}

export const lookupSinglesColumnStorageKey = SINGLES_STORAGE_KEY;
export const lookupAuditColumnStorageKey = AUDIT_STORAGE_KEY;
