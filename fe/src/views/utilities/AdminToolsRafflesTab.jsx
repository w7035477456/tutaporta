import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { fetchAdminRaffleLogEvents, fetchAdminRaffleLogLookup } from 'api/adminToolsFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

const ACTION_OPTIONS = ['generate', 'draw', 'code', 'scan', 'payout'];
const RESULT_OPTIONS = ['valid', 'invalid', 'already_claimed'];
const ALL_WHEN = ['past', 'today', 'future'];
const WHEN_OPTIONS = [
  ['past', 'Past'],
  ['today', 'Today'],
  ['future', 'Future']
];

const COLUMNS = [
  { key: 'when', label: 'when' },
  { key: 'action', label: 'action' },
  { key: 'number', label: 'number', numeric: true },
  { key: 'code', label: 'code' },
  { key: 'result', label: 'result' },
  { key: 'singlesId', label: 'singles', numeric: true },
  { key: 'name', label: 'name' },
  { key: 'event', label: 'event' },
  { key: 'host', label: 'host' }
];

/** Header click cycles: log order → descending → ascending → log order. */
const NEXT_SORT_DIR = { none: 'desc', desc: 'asc', asc: 'none' };

/** Room left under the table for the fixed site footer. */
const TABLE_BOTTOM_GAP_PX = 96;
const TABLE_MIN_HEIGHT_PX = 200;

const LOG_YELLOW = '#ffeb3b';
const MONO = 'Menlo, Consolas, "Courier New", monospace';

const labelSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.9rem', sm: '1rem' },
  color: 'var(--theme-inverse-daynight-color)',
  whiteSpace: 'nowrap',
  flexShrink: 0
};

const bigOrSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '0.95rem', sm: '1.05rem' },
  color: 'var(--theme-primary-color)',
  px: 0.25,
  flexShrink: 0
};

const fieldSx = {
  height: 34,
  minWidth: 0,
  fontSize: 15,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 600,
  px: 1,
  bgcolor: '#fff',
  color: '#111',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  boxSizing: 'border-box'
};

const panelSx = {
  width: '100%',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  p: { xs: 1.25, sm: 1.75 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5
};

const rowSx = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5 } };

const cellSx = { px: 1, py: 0.25, textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' };

function compareRows(a, b, column) {
  if (column.numeric) {
    const x = a[column.key] === '' ? Number.NEGATIVE_INFINITY : Number(a[column.key]);
    const y = b[column.key] === '' ? Number.NEGATIVE_INFINITY : Number(b[column.key]);
    return x - y;
  }
  return String(a[column.key] ?? '').localeCompare(String(b[column.key] ?? ''), undefined, { sensitivity: 'base' });
}

function Field({ label, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography component="label" sx={labelSx}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** Checkbox multi-select; empty value = All. */
function MultiSelect({ options, value, onChange, width = 170 }) {
  return (
    <Select
      multiple
      displayEmpty
      value={value}
      onChange={(e) => {
        const next = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
        onChange(next.includes('') ? [] : next);
      }}
      renderValue={(selected) => (selected.length ? selected.join(', ') : 'All')}
      sx={{
        ...fieldSx,
        width,
        p: 0,
        '& .MuiSelect-select': { py: 0, px: 1, display: 'flex', alignItems: 'center', color: '#111' },
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '& .MuiSvgIcon-root': { color: '#111' }
      }}
    >
      <MenuItem value="">
        <Checkbox size="small" checked={!value.length} sx={{ p: 0.5 }} />
        All
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          <Checkbox size="small" checked={value.includes(option)} sx={{ p: 0.5 }} />
          {option}
        </MenuItem>
      ))}
    </Select>
  );
}

function OrText() {
  return (
    <Typography sx={bigOrSx} aria-hidden>
      OR
    </Typography>
  );
}

export default function AdminToolsRafflesTab({ onError }) {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [actions, setActions] = useState([]);
  const [results, setResults] = useState([]);
  const [singlesId, setSinglesId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [when, setWhen] = useState(ALL_WHEN);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sort, setSort] = useState({ key: '', dir: 'none' });
  const tableBoxRef = useRef(null);
  const [tableHeight, setTableHeight] = useState(null);

  useLayoutEffect(() => {
    if (!hasSearched || busy) return undefined;
    const fit = () => {
      const box = tableBoxRef.current;
      if (!box) return;
      const top = box.getBoundingClientRect().top + window.scrollY;
      setTableHeight(Math.max(TABLE_MIN_HEIGHT_PX, Math.floor(window.innerHeight - top - TABLE_BOTTOM_GAP_PX)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [hasSearched, busy, rows.length]);

  useEffect(() => {
    fetchAdminRaffleLogEvents()
      .then(setEvents)
      .catch((err) => onError?.(err?.response?.data?.error || err?.message || 'Failed to load raffle events'));
  }, [onError]);

  const handleLookup = useCallback(async () => {
    setBusy(true);
    setHasSearched(true);
    onError?.('');
    try {
      const data = await fetchAdminRaffleLogLookup({
        eventId: eventId ? Number(eventId) : undefined,
        action: actions.length ? actions : undefined,
        result: results.length ? results : undefined,
        singlesId: singlesId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        when: when.length && when.length < ALL_WHEN.length ? when : undefined
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setRows([]);
      onError?.(err?.response?.data?.error || err?.message || 'Failed to read the raffle log');
    } finally {
      setBusy(false);
    }
  }, [actions, eventId, from, onError, results, singlesId, to, when]);

  const handleClear = useCallback(() => {
    setEventId('');
    setActions([]);
    setResults([]);
    setSinglesId('');
    setFrom('');
    setTo('');
    setWhen(ALL_WHEN);
    setRows([]);
    setHasSearched(false);
    setSort({ key: '', dir: 'none' });
    onError?.('');
  }, [onError]);

  const toggleWhen = (value) => setWhen((prev) => (prev.includes(value) ? prev.filter((w) => w !== value) : [...prev, value]));

  const cycleSort = (key) =>
    setSort((prev) => {
      const dir = prev.key === key ? NEXT_SORT_DIR[prev.dir] : 'desc';
      return { key: dir === 'none' ? '' : key, dir };
    });

  const sortedRows = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key);
    if (!column || sort.dir === 'none') return rows;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => sign * compareRows(a.row, b.row, column) || a.index - b.index)
      .map(({ row }) => row);
  }, [rows, sort]);

  const onEnter = (e) => {
    if (e.key === 'Enter') void handleLookup();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <Box sx={panelSx}>
        <Box sx={rowSx}>
          <Box sx={{ border: '3px solid #ffe01b', bgcolor: '#ffe01b', p: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography component="label" sx={{ ...labelSx, color: '#111' }}>
              Event
            </Typography>
            <Box
              component="select"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              sx={{ ...fieldSx, maxWidth: { xs: 200, sm: 260 } }}
            >
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.eventId} value={String(ev.eventId)}>
                  {ev.title}
                </option>
              ))}
            </Box>
          </Box>
          <Field label="Action">
            <MultiSelect options={ACTION_OPTIONS} value={actions} onChange={setActions} />
          </Field>
          <OrText />
          <Field label="Result">
            <MultiSelect options={RESULT_OPTIONS} value={results} onChange={setResults} width={190} />
          </Field>
          <OrText />
          <Field label="Singles ID">
            <Box
              component="input"
              value={singlesId}
              inputMode="numeric"
              onChange={(e) => setSinglesId(e.target.value.replace(/\D/g, ''))}
              onKeyDown={onEnter}
              sx={{ ...fieldSx, width: 110 }}
            />
          </Field>
        </Box>

        <Box sx={rowSx}>
          <Field label="From">
            <Box component="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} sx={{ ...fieldSx, width: 150 }} />
          </Field>
          <Field label="To">
            <Box component="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} sx={{ ...fieldSx, width: 150 }} />
          </Field>
          <OrText />
          {WHEN_OPTIONS.map(([value, label]) => (
            <Box
              key={value}
              component="label"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                ...labelSx,
                fontSize: { xs: '1rem', sm: '1.15rem' }
              }}
            >
              <Box
                component="input"
                type="checkbox"
                checked={when.includes(value)}
                onChange={() => toggleWhen(value)}
                sx={{ width: 18, height: 18, m: 0, cursor: 'pointer' }}
              />
              {label}
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1.5, ml: { md: 'auto' } }}>
            <SelectedButtonTemplate type="button" disabled={busy} onClick={handleClear}>
              Clear
            </SelectedButtonTemplate>
            <SelectedButtonTemplate type="button" disabled={busy} onClick={() => void handleLookup()}>
              {busy ? 'Searching…' : 'Lookup'}
            </SelectedButtonTemplate>
          </Box>
        </Box>
        {!hasSearched ? (
          <ColorTemplate9TableData.EmptyText>
            Pick any filters (all are combined) and press Lookup. Leave everything empty to show the whole raffle log.
          </ColorTemplate9TableData.EmptyText>
        ) : null}
      </Box>

      {hasSearched && !busy ? (
        <Box
          ref={tableBoxRef}
          sx={{
            width: '100%',
            height: tableHeight ? `${tableHeight}px` : 'auto',
            overflow: 'auto',
            overscrollBehavior: 'contain',
            bgcolor: '#000',
            border: '1px solid #333',
            px: 1,
            pb: 1,
            boxSizing: 'border-box'
          }}
        >
          {!rows.length ? (
            <Typography sx={{ fontFamily: MONO, color: LOG_YELLOW }}>No matching raffle log rows.</Typography>
          ) : (
            <Box component="table" sx={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, color: LOG_YELLOW }}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key && sort.dir !== 'none';
                    return (
                      <Box
                        component="th"
                        key={c.key}
                        onClick={() => cycleSort(c.key)}
                        title="Click to sort: descending → ascending → log order"
                        sx={{
                          ...cellSx,
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '1px dashed #fff',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          bgcolor: '#000',
                          pt: 1
                        }}
                      >
                        {c.label}
                        {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </Box>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={`${row.when}-${row.action}-${row.code}-${index}`}>
                    {COLUMNS.map((c) => (
                      <Box component="td" key={c.key} sx={cellSx}>
                        {row[c.key] === '' || row[c.key] == null ? '-' : String(row[c.key])}
                      </Box>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Box>
          )}
          <Typography sx={{ fontFamily: MONO, color: LOG_YELLOW, fontSize: 12, mt: 1 }}>{rows.length} row(s)</Typography>
        </Box>
      ) : null}
    </Box>
  );
}
