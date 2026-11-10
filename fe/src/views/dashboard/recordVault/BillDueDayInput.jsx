import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  BILL_SCHEDULE_INK,
  BILL_SCHEDULE_SURFACE,
  billScheduleBorderedBoxSx,
  billScheduleNavBtnSx
} from './billScheduleTheme';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
const SELECTED_BG = '#1976d2';
const TODAY_OUTLINE = '#e74c3c';

/**
 * Typed due date → { year, month, day }, '' for blank, or null when unreadable.
 * Accepts "15", "15th", "11/15", "11-15-2026", "17/06/2019", "2026-11-15", "Nov 15", "November 15, 2026".
 * Inputs without a month / year keep the given defaults.
 */
export function parseDueDateParts(raw, defaultYear, defaultMonth) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  let y = defaultYear;
  let mo = defaultMonth;
  let day = null;
  let m = s.match(/^(\d{1,2})(st|nd|rd|th)?$/i);
  if (m) day = Number(m[1]);
  if (day == null) {
    m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (m) [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  if (day == null) {
    m = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
    if (m) {
      // MM/DD, unless the first number can only be a day (17/06/2019 → DD/MM).
      const first = Number(m[1]);
      const second = Number(m[2]);
      [mo, day] = first > 12 && second <= 12 ? [second, first] : [first, second];
      if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    }
  }
  if (day == null && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d/i.test(s)) {
    const parsed = new Date(/\d{4}/.test(s) ? s : `${s} ${defaultYear}`);
    if (!Number.isNaN(parsed.getTime())) {
      y = parsed.getFullYear();
      mo = parsed.getMonth() + 1;
      day = parsed.getDate();
    }
  }
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return { year: y, month: mo, day: Math.trunc(day) };
}

/** Typed due date → day of month (1–31), '' for blank, or null when unreadable. */
export function parseDueDayInput(raw, year) {
  const parts = parseDueDateParts(raw, year, 1);
  if (parts === '' || parts === null) return parts;
  return parts.day;
}

function formatMmDdYyyy(year, month, day) {
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

function shiftYearMonth(year, month, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** 6 × 7 grid for a month, padded with the previous / next month's days. */
function buildMonthGrid(year, month) {
  const startWd = new Date(year, month - 1, 1).getDay();
  const dim = new Date(year, month, 0).getDate();
  const prev = shiftYearMonth(year, month, -1);
  const next = shiftYearMonth(year, month, 1);
  const prevDim = new Date(prev.year, prev.month, 0).getDate();
  const cells = [];
  for (let i = startWd - 1; i >= 0; i -= 1) cells.push({ ...prev, day: prevDim - i, outside: true });
  for (let d = 1; d <= dim; d += 1) cells.push({ year, month, day: d, outside: false });
  for (let d = 1; cells.length < 42; d += 1) cells.push({ ...next, day: d, outside: true });
  return cells;
}

/**
 * Bill Schedule Due Date cell: type a day or a date; double-click opens a calendar with its own
 * date box and ‹ › month arrows. The stored value is the day of month (1–31).
 */
export default function BillDueDayInput({ value, year, month, onChange, sx }) {
  const anchorRef = useRef(null);
  const [draft, setDraft] = useState(value === '' || value == null ? '' : String(value));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [view, setView] = useState({ year, month });
  const [highlightDay, setHighlightDay] = useState(null);
  const [popDraft, setPopDraft] = useState('');

  useEffect(() => {
    setDraft(value === '' || value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const day = parseDueDayInput(draft, year);
    if (day === null) {
      setDraft(value === '' || value == null ? '' : String(value));
      return;
    }
    setDraft(day === '' ? '' : String(day));
    if (String(day) !== String(value ?? '')) onChange(day);
  };

  const pickDay = (day) => {
    setCalendarOpen(false);
    setDraft(String(day));
    if (String(day) !== String(value ?? '')) onChange(day);
  };

  const openCalendar = () => {
    const day = Number(value);
    const validDay = Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
    setView({ year, month });
    setHighlightDay(validDay);
    setPopDraft(validDay ? formatMmDdYyyy(year, month, validDay) : '');
    setCalendarOpen(true);
  };

  const shiftView = (delta) => {
    const next = shiftYearMonth(view.year, view.month, delta);
    setView(next);
    if (highlightDay) setPopDraft(formatMmDdYyyy(next.year, next.month, highlightDay));
  };

  const onPopDraftChange = (text) => {
    setPopDraft(text);
    const parts = parseDueDateParts(text, view.year, view.month);
    if (!parts) return;
    setView({ year: parts.year, month: parts.month });
    setHighlightDay(parts.day);
  };

  const commitPopDraft = () => {
    const parts = parseDueDateParts(popDraft, view.year, view.month);
    if (parts) pickDay(parts.day);
  };

  const today = new Date();
  const cells = buildMonthGrid(view.year, view.month);

  return (
    <>
      <TextField
        fullWidth
        size="small"
        ref={anchorRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onDoubleClick={openCalendar}
        placeholder="1–31"
        title="Type a day or date, or double-click for a calendar"
        inputProps={{ inputMode: 'text', 'aria-label': 'Due date' }}
        sx={sx}
      />
      <Popover
        open={calendarOpen}
        anchorEl={anchorRef.current}
        onClose={() => setCalendarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { ...billScheduleBorderedBoxSx, color: BILL_SCHEDULE_INK, p: 1.25 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            autoFocus
            value={popDraft}
            onChange={(e) => onPopDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPopDraft();
              }
            }}
            placeholder="MM/DD/YYYY"
            inputProps={{ 'aria-label': 'Type a due date' }}
            sx={{
              flex: 1,
              '& .MuiInputBase-input': { py: 0.5, px: 0.75, color: BILL_SCHEDULE_INK, fontWeight: 700 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: BILL_SCHEDULE_INK }
            }}
          />
          <Box
            component="button"
            type="button"
            aria-label="Previous month"
            onClick={() => shiftView(-1)}
            sx={{ ...billScheduleNavBtnSx, px: 1, lineHeight: 1 }}
          >
            ‹
          </Box>
          <Box
            component="button"
            type="button"
            aria-label="Next month"
            onClick={() => shiftView(1)}
            sx={{ ...billScheduleNavBtnSx, px: 1, lineHeight: 1 }}
          >
            ›
          </Box>
        </Box>
        <Typography sx={{ fontWeight: 800, textAlign: 'center', mb: 0.75 }}>
          {MONTH_NAMES[view.month - 1]} {view.year}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 2.25rem)', gap: 0.5, textAlign: 'center' }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <Typography key={d} sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {d}
            </Typography>
          ))}
          {cells.map((cell) => {
            const selected = !cell.outside && highlightDay === cell.day;
            const isToday =
              today.getFullYear() === cell.year && today.getMonth() + 1 === cell.month && today.getDate() === cell.day;
            return (
              <Box
                key={`${cell.year}-${cell.month}-${cell.day}`}
                component="button"
                type="button"
                aria-label={`Due on day ${cell.day}`}
                aria-pressed={selected}
                onClick={() => pickDay(cell.day)}
                sx={{
                  width: '2.25rem',
                  height: '2.25rem',
                  border: isToday ? `2px solid ${TODAY_OUTLINE}` : '2px solid transparent',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  bgcolor: selected ? SELECTED_BG : BILL_SCHEDULE_SURFACE,
                  color: selected ? '#fff' : BILL_SCHEDULE_INK,
                  opacity: cell.outside ? 0.4 : 1,
                  '&:hover': { bgcolor: selected ? SELECTED_BG : 'rgba(25, 118, 210, 0.2)' }
                }}
              >
                {cell.day}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}

BillDueDayInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  sx: PropTypes.object
};
