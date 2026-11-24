import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

/** Past due: alternate full colour ↔ grey (hard switch, no fade). */
const dueBlink = keyframes`
  0% { filter: none; }
  50% { filter: grayscale(1) brightness(0.95); }
`;

/** Local calendar day as 'YYYY-MM-DD' (same shape as the stored due_date). */
export function localDateKey(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 'YYYY-MM-DD' → 'MM/DD/YYYY'. */
export function formatDueDate(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

function isValidDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** "Due Date" calendar glyph: grey when unset, red/yellow when set. */
function DueDateGlyph({ set }) {
  const header = set ? '#e60000' : '#757575';
  const body = set ? '#FFEB3B' : '#d0d0d0';
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden focusable="false" style={{ display: 'block' }}>
      <rect x="3" y="7" width="30" height="26" rx="3" fill={body} stroke="#000" strokeWidth="2" />
      <path d="M3 10 a3 3 0 0 1 3 -3 h24 a3 3 0 0 1 3 3 v6 h-30 z" fill={header} stroke="#000" strokeWidth="2" />
      <rect x="9" y="2" width="4" height="9" rx="1.5" fill="#000" />
      <rect x="23" y="2" width="4" height="9" rx="1.5" fill="#000" />
      <text x="18" y="24" textAnchor="middle" fontSize="7" fontWeight="900" fontFamily="Arial, sans-serif" fill="#000">
        DUE
      </text>
      <text x="18" y="31" textAnchor="middle" fontSize="7" fontWeight="900" fontFamily="Arial, sans-serif" fill="#000">
        DATE
      </text>
    </svg>
  );
}

DueDateGlyph.propTypes = { set: PropTypes.bool };

const popBtnSx = {
  border: '2px solid #000',
  borderRadius: 1,
  px: 1.5,
  py: 0.4,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: '0.95rem',
  cursor: 'pointer',
  color: '#000',
  WebkitTextFillColor: '#000',
  '&:disabled': { opacity: 0.4, cursor: 'default' },
  '&:hover:not(:disabled)': { filter: 'brightness(1.06)' }
};

/**
 * ToDo task Due Date button. Click → popup to pick a date (calendar) or type mm/dd/yyyy.
 * `blink` = past due and not done: icon alternates colour ↔ grey.
 */
export default function TodoDueDateButton({ value = null, onChange, blink = false, disabled = false }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState('');
  const set = Boolean(value);
  const open = Boolean(anchorEl);

  const openPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDraft(value || localDateKey());
    setAnchorEl(e.currentTarget);
  };
  const close = () => setAnchorEl(null);
  const save = () => {
    if (!isValidDateKey(draft)) return;
    onChange?.(draft);
    close();
  };
  const clear = () => {
    onChange?.(null);
    close();
  };

  const label = set ? `Due ${formatDueDate(value)}${blink ? ' — PAST DUE' : ''} (click to change)` : 'Set a due date';

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={openPicker}
        sx={{
          flexShrink: 0,
          p: 0,
          m: 0,
          border: 'none',
          bgcolor: 'transparent',
          lineHeight: 0,
          cursor: disabled ? 'default' : 'pointer',
          animation: set && blink ? `${dueBlink} 1s steps(1, end) infinite` : 'none',
          '&:hover:not(:disabled)': { transform: 'scale(1.12)' },
          transition: 'transform 0.12s ease'
        }}
      >
        <DueDateGlyph set={set} />
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { border: '3px solid #000', borderRadius: 1.5, p: 1.5, bgcolor: '#fff' } } }}
      >
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 230, fontFamily: MAIN_FONT_FAMILY }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#000 !important', WebkitTextFillColor: '#000 !important' }}>
            Due date
          </Typography>
          <TextField
            type="date"
            size="small"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputProps={{ min: '2000-01-01', max: '2100-12-31', 'aria-label': 'Due date (mm/dd/yyyy)' }}
            helperText="Pick from the calendar or type mm/dd/yyyy"
            sx={{
              '& .MuiInputBase-root': { bgcolor: '#fff', fontSize: '1.05rem', fontWeight: 700 },
              '& input': { color: '#000', WebkitTextFillColor: '#000' },
              '& .MuiFormHelperText-root': { mx: 0, color: '#555' }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Box component="button" type="button" onClick={clear} disabled={!set} sx={{ ...popBtnSx, bgcolor: '#bdbdbd', mr: 'auto' }}>
              Clear
            </Box>
            <Box component="button" type="button" onClick={close} sx={{ ...popBtnSx, bgcolor: '#FFEB3B' }}>
              Cancel
            </Box>
            <Box component="button" type="submit" disabled={!isValidDateKey(draft)} sx={{ ...popBtnSx, bgcolor: '#60C446' }}>
              Save
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}

TodoDueDateButton.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  blink: PropTypes.bool,
  disabled: PropTypes.bool
};
