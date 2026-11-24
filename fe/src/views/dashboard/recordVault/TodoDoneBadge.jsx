import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

/** ISO → 'YYYY-MM-DDTHH:mm' in local time (datetime-local input value). */
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO → "11/23/2026 3:45 PM" (local). */
export function formatDoneAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} ${time}`;
}

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
 * Green "✓ DONE" badge on tasks in Todo Done. Click → popup showing when the task was done,
 * editable (date + time) and saved via onChange(ISO string).
 */
export default function TodoDoneBadge({ value = null, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState('');
  const open = Boolean(anchorEl);

  const openPopup = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(toLocalInput(value));
    setAnchorEl(e.currentTarget);
  };
  const close = () => setAnchorEl(null);
  const draftDate = draft ? new Date(draft) : null; // datetime-local string parses as local time
  const draftValid = Boolean(draftDate) && !Number.isNaN(draftDate.getTime()) && draftDate.getFullYear() >= 2000;
  const save = () => {
    if (!draftValid) return;
    onChange?.(draftDate.toISOString());
    close();
  };

  const label = value ? `Done ${formatDoneAt(value)} (click to view / edit)` : 'Done — click to set when it was done';

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={label}
        title={label}
        onClick={openPopup}
        sx={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          px: 0.75,
          py: 0.25,
          border: '2px solid #000',
          borderRadius: 999,
          bgcolor: '#ffffff',
          color: '#1b5e20',
          WebkitTextFillColor: '#1b5e20',
          fontFamily: MAIN_FONT_FAMILY,
          fontWeight: 900,
          fontSize: '0.75rem',
          lineHeight: 1,
          cursor: 'pointer',
          transition: 'transform 0.12s ease',
          '&:hover': { transform: 'scale(1.08)' }
        }}
      >
        <Box
          component="span"
          aria-hidden
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: '#2e7d32',
            color: '#fff',
            WebkitTextFillColor: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem'
          }}
        >
          ✓
        </Box>
        DONE
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
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 260, fontFamily: MAIN_FONT_FAMILY }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#000 !important', WebkitTextFillColor: '#000 !important' }}>
            Done on
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1b5e20 !important', WebkitTextFillColor: '#1b5e20 !important' }}>
            {value ? formatDoneAt(value) : 'Not recorded yet'}
          </Typography>
          <TextField
            type="datetime-local"
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputProps={{ min: '2000-01-01T00:00', max: '2100-12-31T23:59', 'aria-label': 'Done date and time' }}
            helperText="Change the date / time, then Save"
            sx={{
              '& .MuiInputBase-root': { bgcolor: '#fff', fontSize: '1.05rem', fontWeight: 700 },
              '& input': { color: '#000', WebkitTextFillColor: '#000' },
              '& .MuiFormHelperText-root': { mx: 0, color: '#555' }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Box component="button" type="button" onClick={close} sx={{ ...popBtnSx, bgcolor: '#FFEB3B' }}>
              Cancel
            </Box>
            <Box component="button" type="submit" disabled={!draftValid} sx={{ ...popBtnSx, bgcolor: '#60C446' }}>
              Save
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}

TodoDoneBadge.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func
};
