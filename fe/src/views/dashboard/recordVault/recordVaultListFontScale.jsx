import { useSyncExternalStore } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import api from 'api/axios';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

/**
 * TutaNotes "Font: + −" — one percent scale for the Notebook / Note / Shortcut / Recent list
 * labels. Saved per user on the server (mynote_ui_pref.list_font_pct) so it comes back next visit.
 */
export const LIST_FONT_PCT_MIN = 50;
export const LIST_FONT_PCT_MAX = 250;
export const LIST_FONT_PCT_STEP = 10;
const SAVE_DEBOUNCE_MS = 500;

let pct = 100;
let loadStarted = false;
let saveTimer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function clampPct(n) {
  const v = Math.round(Number(n) / LIST_FONT_PCT_STEP) * LIST_FONT_PCT_STEP;
  if (!Number.isFinite(v)) return 100;
  return Math.min(LIST_FONT_PCT_MAX, Math.max(LIST_FONT_PCT_MIN, v));
}

/** Load the member's saved scale once per page load. */
function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  api
    .get('/api/mynoteUiPref')
    .then(({ data }) => {
      const next = clampPct(data?.list_font_pct ?? 100);
      if (next !== pct) {
        pct = next;
        emit();
      }
    })
    .catch(() => {
      // Not signed in / table missing → stay at 100%; allow a retry on the next mount.
      loadStarted = false;
    });
}

export function setListFontPct(next) {
  const v = clampPct(next);
  if (v === pct) return;
  pct = v;
  emit();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    api.put('/api/mynoteUiPref', { list_font_pct: pct }).catch(() => {
      // Best effort — the scale still applies for this session.
    });
  }, SAVE_DEBOUNCE_MS);
}

/** Current list font scale in percent (100 = default). */
export function useListFontPct() {
  ensureLoaded();
  return useSyncExternalStore(
    subscribe,
    () => pct,
    () => pct
  );
}

const fontBtnSx = {
  minWidth: 30,
  height: 30,
  p: 0,
  border: '2px solid #000',
  borderRadius: 1,
  bgcolor: '#FFEB3B',
  color: '#000',
  WebkitTextFillColor: '#000',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 900,
  fontSize: '1.4rem',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:disabled': { opacity: 0.35, cursor: 'default' },
  '&:hover:not(:disabled)': { filter: 'brightness(1.08)', transform: 'scale(1.08)' }
};

/** "Font: + −" control for the TutaNotes title row. */
export function RecordVaultListFontControl({ sx }) {
  const value = useListFontPct();
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ...sx }} title={`List font size ${value}%`}>
      <Box
        component="span"
        sx={{
          fontFamily: MAIN_FONT_FAMILY,
          fontWeight: 900,
          fontSize: '1.35rem',
          color: '#FFEB3B',
          WebkitTextFillColor: '#FFEB3B',
          WebkitTextStroke: '1.2px #000',
          paintOrder: 'stroke fill',
          userSelect: 'none'
        }}
      >
        Font:
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Increase list font size"
        title={`Bigger (${value}%)`}
        disabled={value >= LIST_FONT_PCT_MAX}
        onClick={() => setListFontPct(value + LIST_FONT_PCT_STEP)}
        sx={fontBtnSx}
      >
        +
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Decrease list font size"
        title={`Smaller (${value}%)`}
        disabled={value <= LIST_FONT_PCT_MIN}
        onClick={() => setListFontPct(value - LIST_FONT_PCT_STEP)}
        sx={fontBtnSx}
      >
        −
      </Box>
    </Box>
  );
}

RecordVaultListFontControl.propTypes = { sx: PropTypes.object };
