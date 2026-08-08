import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimeClock } from '@mui/x-date-pickers/TimeClock';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { NOT_AVAILABLE, toDisplayVettedDate } from './verifySelfVettedDate';

dayjs.extend(customParseFormat);

const PARSE_DISPLAY = 'MMM DD, YYYY [at] hh:mm A';

function parseRowValueToDayjs(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === NOT_AVAILABLE || s.toLowerCase() === 'n/a') return null;
  const formatted = dayjs(s, PARSE_DISPLAY, true);
  if (formatted.isValid()) return formatted;
  const loose = dayjs(s);
  return loose.isValid() ? loose : null;
}

export default function VettedDateTimeDialog({ open, value, onClose, onCommit }) {
  const [mode, setMode] = useState('pick');
  const [draft, setDraft] = useState(() => dayjs());

  useEffect(() => {
    if (!open) return;
    const parsed = parseRowValueToDayjs(value);
    setDraft(parsed && parsed.isValid() ? parsed : dayjs());
    setMode('pick');
  }, [open, value]);

  const previewSource = mode === 'now' ? dayjs() : draft;
  const headerLine = previewSource.isValid() ? previewSource.format('MM/DD/YYYY hh:mm A') : '';

  const handleSubmit = () => {
    const finalD = mode === 'now' ? dayjs() : draft;
    if (!finalD || !finalD.isValid()) {
      onClose();
      return;
    }
    onCommit(toDisplayVettedDate(finalD.valueOf()));
    onClose();
  };

  const handleClear = () => {
    onCommit(NOT_AVAILABLE);
    onClose();
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close date and time picker"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <EventIcon fontSize="small" />
            <ScheduleIcon fontSize="small" />
            <Typography component="span" variant="inherit">
              {headerLine}
            </Typography>
          </Box>
        </ColorTemplate7PopupLargeDark.Title>

        <FormControl component="fieldset" sx={{ width: '100%', maxWidth: '100%' }}>
          <RadioGroup
            row
            value={mode}
            onChange={(e) => {
              const next = e.target.value;
              setMode(next);
              if (next === 'now') setDraft(dayjs());
            }}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            <FormControlLabel value="pick" control={<ColorTemplate7PopupLargeDark.Radio />} label="Pick date & time" />
            <FormControlLabel
              value="now"
              control={<ColorTemplate7PopupLargeDark.Radio />}
              label="Now (use current date and time on Submit)"
            />
          </RadioGroup>
        </FormControl>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'nowrap',
              gap: { xs: 1, sm: 1.5 },
              justifyContent: 'center',
              alignItems: { xs: 'center', sm: 'flex-start' },
              width: 'fit-content',
              maxWidth: '100%',
              mx: 'auto'
            }}
          >
            <Box
              sx={{
                flex: '0 0 auto',
                display: 'flex',
                justifyContent: 'center',
                pl: { xs: 1, sm: 2 },
                '& .MuiDateCalendar-root': { width: { xs: 280, sm: 256 }, maxWidth: '100%' }
              }}
            >
              <DateCalendar
                value={draft}
                onChange={(newDate) => {
                  if (!newDate || !newDate.isValid()) return;
                  setDraft((prev) => {
                    const p = prev && prev.isValid() ? prev : dayjs();
                    return newDate.hour(p.hour()).minute(p.minute()).second(0).millisecond(0);
                  });
                }}
                disabled={mode === 'now'}
              />
            </Box>
            <Box
              sx={{
                flex: '0 0 auto',
                display: 'flex',
                justifyContent: 'center',
                transform: { xs: 'scale(0.92)', sm: 'scale(0.86)' },
                transformOrigin: 'center center'
              }}
            >
              <TimeClock
                value={draft}
                onChange={(newValue) => {
                  if (!newValue || !newValue.isValid()) return;
                  setDraft((prev) => {
                    const base = prev && prev.isValid() ? prev : dayjs();
                    return base.hour(newValue.hour()).minute(newValue.minute()).second(0).millisecond(0);
                  });
                }}
                ampm
                ampmInClock
                disabled={mode === 'now'}
              />
            </Box>
          </Box>
        </LocalizationProvider>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={handleClear}>Clear</ColorTemplate7PopupLargeDark.ActionButton>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={onClose}>Cancel</ColorTemplate7PopupLargeDark.ActionButton>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={handleSubmit}>Submit</ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
