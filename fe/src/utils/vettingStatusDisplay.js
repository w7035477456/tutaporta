/** Display labels and chip styles for vetting_status enum values. */

export const VETTING_STATUS_CYCLE = [
  'info_matches',
  'verification_in_progress',
  'info_not_matches',
  'verification_not_started',
  'unable_find_info'
];

export function normalizeVettingStatusKey(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'verifcation_not_started') return 'verification_not_started';
  if (VETTING_STATUS_CYCLE.includes(s)) return s;
  return 'verification_not_started';
}

export function cycleVettingStatus(current) {
  const normalized = normalizeVettingStatusKey(current);
  const idx = VETTING_STATUS_CYCLE.indexOf(normalized);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % VETTING_STATUS_CYCLE.length;
  return VETTING_STATUS_CYCLE[nextIdx];
}

export function vettingStatusLabel(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  const map = {
    info_matches: 'Info Matches',
    verification_in_progress: 'Verification in progress',
    info_not_matches: 'Info Not Matches',
    verifcation_not_started: 'Not Started',
    verification_not_started: 'Not Started',
    unable_find_info: 'Unable Find'
  };
  if (map[s]) return map[s];
  if (!s) return 'Not Started';
  return s.replace(/_/g, ' ');
}

/** Compact label for Matching Status column (circle + short text). */
export function vettingStatusCompactLabel(raw) {
  const s = normalizeVettingStatusKey(raw);
  const map = {
    info_matches: 'Data Matched',
    verification_in_progress: 'In Progress',
    info_not_matches: 'Not Match',
    verification_not_started: 'Not Started',
    unable_find_info: 'Not Found'
  };
  return map[s] || 'Not Started';
}

/** Colored dot for compact Matching Status indicator. */
export const VETTING_STATUS_DOT_SIZE_PX = 42;

export function vettingStatusDotSx(raw) {
  const s = normalizeVettingStatusKey(raw);
  if (s === 'info_matches') {
    return { bgcolor: '#2e7d32', border: '6px solid #1b5e20' };
  }
  if (s === 'verification_in_progress') {
    return { bgcolor: '#1565c0', border: '6px solid #0d47a1' };
  }
  if (s === 'info_not_matches') {
    return { bgcolor: '#c62828', border: '6px solid #b71c1c' };
  }
  if (s === 'unable_find_info') {
    return { bgcolor: '#ff9800', border: '6px solid #ef6c00' };
  }
  return { bgcolor: '#ffffff', border: '6px solid #9e9e9e' };
}

export function vettingStatusChipSx(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'info_matches') {
    return { bgcolor: '#2e7d32', color: '#fff', border: '1px solid #2e7d32' };
  }
  if (s === 'verification_in_progress') {
    return { bgcolor: '#1565c0', color: '#fff', border: '1px solid #1565c0' };
  }
  if (s === 'info_not_matches') {
    return { bgcolor: '#c62828', color: '#fff', border: '1px solid #c62828' };
  }
  if (s === 'unable_find_info') {
    return { bgcolor: '#c62828', color: '#fff', border: '1px solid #c62828' };
  }
  if (!s || s === 'verification_not_started' || s === 'verifcation_not_started') {
    return { bgcolor: '#ffeb3b', color: '#000000', border: '1px solid #f9a825' };
  }
  return {
    bgcolor: '#fff',
    color: '#616161',
    border: '1px dashed #9e9e9e'
  };
}

export function shouldShowVettedNote(note) {
  const s = String(note ?? '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return lower !== 'n/a' && lower !== 'not available';
}
