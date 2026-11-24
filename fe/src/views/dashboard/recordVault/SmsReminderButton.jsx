import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { deleteSmsReminder, fetchSmsReminder, fetchSmsReminderDefaults, saveSmsReminder } from 'api/smsReminderFe';

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14, 30];
const BLACK = { color: '#000 !important', WebkitTextFillColor: '#000 !important' };

/** 'YYYY-MM-DD' → 'MM/DD/YYYY'. */
function usDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

/** Any typed/pasted US number → its 10 national digits (drops a leading country 1). */
function usDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.slice(0, 10);
}

/** Digits → '(703) 547-7456' as they type; separators only appear once the next digit does. */
function formatUsPhone(d) {
  if (d.length <= 3) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function daysLabel(n) {
  if (n === 0) return 'On the due date';
  return n === 1 ? '1 day ahead' : `${n} days ahead`;
}

/** Phone + "SMS" bubble: grey/black when off, yellow/red when a reminder is set. */
export function SmsGlyph({ on, size = 30 }) {
  const bg = on ? '#FFE600' : '#c8c8c8';
  const bubble = on ? '#e60000' : '#000';
  const dot = on ? '#e60000' : '#fff';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden focusable="false" style={{ display: 'block' }}>
      <rect x="0.5" y="0.5" width="35" height="35" rx="3" fill={bg} stroke="#000" strokeWidth="1" />
      <path d="M8 9 v20 a3 3 0 0 0 3 3 h12 a3 3 0 0 0 3 -3 v-4" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 9 a3 3 0 0 1 3 -3 h2" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="28.5" r="1.8" fill={dot} />
      <ellipse cx="23" cy="12" rx="11.5" ry="8" fill={bubble} />
      <path d="M16 18 l-2.5 5 l6 -4 z" fill={bubble} />
      <text x="23" y="15" textAnchor="middle" fontSize="8" fontWeight="900" fontFamily="Arial, sans-serif" fill="#fff">
        SMS
      </text>
    </svg>
  );
}

SmsGlyph.propTypes = { on: PropTypes.bool, size: PropTypes.number };

const popBtnSx = {
  border: '2px solid #000',
  borderRadius: 1,
  px: 1.5,
  py: 0.4,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: '0.95rem',
  cursor: 'pointer',
  ...BLACK,
  '&:disabled': { opacity: 0.4, cursor: 'default' },
  '&:hover:not(:disabled)': { filter: 'brightness(1.06)' }
};

const fieldSx = {
  '& .MuiInputBase-root': { bgcolor: '#fff', fontSize: '1.05rem', fontWeight: 700 },
  '& input, & .MuiSelect-select': BLACK,
  '& .MuiFormHelperText-root': { mx: 0, color: '#555' }
};

/**
 * SMS reminder icon for a Monthly / Yearly bill row or a ToDo task.
 * Click → popup: phone (last used by default) + days ahead (1 by default). Text goes out at 9am.
 * Save texts a confirmation right away; the icon then turns yellow/red.
 *
 * kind      'monthly' | 'yearly' | 'todo'
 * reminderId current sms_reminder_id (null = off)
 * billId    saved monthly_bill_id / yearly_bill_id (bills only; null = row not saved yet)
 * label     bill description / task text (first 3 words go in the text)
 * dueYmd    next due date 'YYYY-MM-DD' (for the confirmation text and popup), or null
 * onChange  (newReminderIdOrNull) => void
 */
export default function SmsReminderButton({
  kind,
  reminderId = null,
  billId = null,
  label = '',
  dueYmd = null,
  onChange,
  disabled = false
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const on = Boolean(reminderId);
  const needsSavedRow = kind !== 'todo' && !billId;

  const openPopup = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setAnchorEl(e.currentTarget);
    setError('');
    setNote('');
    setBusy(true);
    try {
      if (on) {
        const r = await fetchSmsReminder(reminderId);
        setPhone(usDigits(r.phone));
        setDays(Number(r.days_before ?? 1));
        if (r.last_error) setNote(`Last text failed: ${r.last_error}`);
      } else {
        const d = await fetchSmsReminderDefaults();
        setPhone(usDigits(d.phone));
        setDays(1);
        if (d.configured === false) setNote('Texting is not set up on this server yet.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load reminder');
    } finally {
      setBusy(false);
    }
  };

  const close = () => setAnchorEl(null);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await saveSmsReminder({
        sms_reminder_id: reminderId || undefined,
        kind,
        phone,
        days_before: days,
        label,
        due_date: dueYmd || undefined,
        bill_id: billId || undefined
      });
      onChange?.(result.sms_reminder_id);
      if (result.warning) {
        setNote(result.warning);
      } else {
        close();
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save reminder');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteSmsReminder(reminderId);
      onChange?.(null);
      close();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not turn off reminder');
    } finally {
      setBusy(false);
    }
  };

  const phoneOk = phone.length === 10;
  const title = on ? 'Text reminder is on (click to change)' : 'Text me a reminder';

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={title}
        title={title}
        disabled={disabled}
        onClick={openPopup}
        sx={{
          flexShrink: 0,
          p: 0,
          m: 0,
          border: 'none',
          bgcolor: 'transparent',
          lineHeight: 0,
          cursor: disabled ? 'default' : 'pointer',
          '&:hover:not(:disabled)': { transform: 'scale(1.12)' },
          transition: 'transform 0.12s ease'
        }}
      >
        <SmsGlyph on={on} />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
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
            if (phoneOk && !busy && !needsSavedRow) void save();
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: 290, fontFamily: MAIN_FONT_FAMILY }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', ...BLACK }}>Text me a reminder</Typography>
          <Typography sx={{ fontSize: '0.9rem', ...BLACK }}>
            {label ? (
              <strong>
                {String(label)
                  .replace(/<[^>]*>/g, ' ')
                  .trim()
                  .slice(0, 80)}
              </strong>
            ) : (
              'This item'
            )}
            {dueYmd ? ` — due ${usDate(dueYmd)}` : ''}
          </Typography>
          {needsSavedRow ? (
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#c00 !important', WebkitTextFillColor: '#c00 !important' }}>
              Press SAVE first, then set the reminder.
            </Typography>
          ) : null}
          {kind === 'todo' && !dueYmd ? (
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#c00 !important', WebkitTextFillColor: '#c00 !important' }}>
              Set a due date on this task, or no text will be sent.
            </Typography>
          ) : null}
          <TextField
            size="small"
            autoFocus
            label="Text to (US phone)"
            placeholder="(703) 555-1234"
            value={formatUsPhone(phone)}
            onChange={(e) => setPhone(usDigits(e.target.value))}
            disabled={busy}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ '& p': { fontWeight: 800, ...BLACK } }}>
                  +1
                </InputAdornment>
              )
            }}
            inputProps={{ inputMode: 'tel', autoComplete: 'tel-national' }}
            sx={fieldSx}
          />
          <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={busy} sx={fieldSx}>
            {DAY_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {daysLabel(n)}
              </MenuItem>
            ))}
          </Select>
          <Typography sx={{ fontSize: '0.8rem', color: '#555 !important', WebkitTextFillColor: '#555 !important' }}>
            Texts at 9am. We send a confirmation text now. Reply STOP to any text to opt out.
          </Typography>
          {error ? (
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#c00 !important', WebkitTextFillColor: '#c00 !important' }}>
              {error}
            </Typography>
          ) : null}
          {note ? (
            <Typography
              sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#8a5a00 !important', WebkitTextFillColor: '#8a5a00 !important' }}
            >
              {note}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {on ? (
              <Box
                component="button"
                type="button"
                onClick={() => void turnOff()}
                disabled={busy}
                sx={{ ...popBtnSx, bgcolor: '#bdbdbd', mr: 'auto' }}
              >
                Turn off
              </Box>
            ) : null}
            <Box component="button" type="button" onClick={close} sx={{ ...popBtnSx, bgcolor: '#FFEB3B' }}>
              {note && on ? 'Close' : 'Cancel'}
            </Box>
            <Box component="button" type="submit" disabled={busy || !phoneOk || needsSavedRow} sx={{ ...popBtnSx, bgcolor: '#60C446' }}>
              Save
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}

SmsReminderButton.propTypes = {
  kind: PropTypes.oneOf(['monthly', 'yearly', 'todo']).isRequired,
  reminderId: PropTypes.number,
  billId: PropTypes.number,
  label: PropTypes.string,
  dueYmd: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool
};
