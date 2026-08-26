import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { fetchMonthlyBill, saveMonthlyBill, transferBillSchedule } from 'api/monthlyBillFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import PropTypes from 'prop-types';
import { useRecordVaultPaneStorageType } from './RecordVaultPaneContext';
import { notifyRecordVaultTreeReload } from './recordVaultCrossPaneDrag';
import BillColumnButton from './BillColumnButton';
import BillReceiptsPopup from './BillReceiptsPopup';

const YELLOW = '#ffe566';
const GREEN = '#7dcea0';
const RED = '#e74c3c';
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

const TONE_RANK = { overdue: 4, paid: 3, auto: 2, upcoming: 1, none: 0 };

function blankRow(rowIndex) {
  return {
    monthly_bill_id: null,
    row_index: rowIndex,
    bill_description: '',
    due_day: '',
    amount: '',
    bill_type: 'Manual',
    action: null,
    paid_record_id: null,
    has_bill_content: false,
    status: '',
    status_tone: 'none'
  };
}

function normalizeAmountLocal(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^varied$/i.test(s)) return 'Varied';
  const cleaned = s.replace(/[$,\s]/g, '');
  if (!cleaned) return '';
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return s.slice(0, 64);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeStatusLocal(row, year, month, today = new Date()) {
  if (row.bill_type === 'Auto') return { status: '', status_tone: 'auto' };
  if (row.action === 'Paid') return { status: 'Paid', status_tone: 'paid' };
  const dueDay = Number(row.due_day);
  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
    return { status: '', status_tone: 'none' };
  }
  const due = new Date(year, month - 1, dueDay);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (todayStart > due) return { status: 'Over Due', status_tone: 'overdue' };
  return { status: '', status_tone: 'upcoming' };
}

function withDerived(rows, year, month) {
  return (rows || []).map((r) => ({
    ...r,
    ...computeStatusLocal(r, year, month)
  }));
}

function cellToneBg(tone) {
  if (tone === 'auto') return YELLOW;
  if (tone === 'paid') return GREEN;
  if (tone === 'overdue') return RED;
  return 'transparent';
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

const navBtnSx = {
  border: '2px solid #000',
  borderRadius: 1,
  bgcolor: '#fff',
  px: 1,
  py: 0.25,
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: '1.1rem',
  lineHeight: 1
};

export default function BillScheduleMonthlyPanel({ storageType: storageTypeProp }) {
  const paneStorageType = useRecordVaultPaneStorageType();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [billPopupOpen, setBillPopupOpen] = useState(false);
  const [billEnsurePayload, setBillEnsurePayload] = useState(null);
  const [peerHasRows, setPeerHasRows] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const storageKey =
    String(storageTypeProp || paneStorageType || '').toLowerCase() === 'usb' ? 'usb' : 'onedrive';
  const peerKey = storageKey === 'usb' ? 'onedrive' : 'usb';
  const sideLabel = storageKey === 'usb' ? 'USB' : 'Cloud';
  const peerLabel = peerKey === 'usb' ? 'USB' : 'Cloud';

  const load = useCallback(async (y, m) => {
    setLoading(true);
    setError('');
    setSavedMsg('');
    try {
      const data = await fetchMonthlyBill(y, m, { storageType: storageKey });
      setRows(withDerived(data?.rows || [], y, m));
      setPeerHasRows(Boolean(data?.peer_has_rows));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load monthly bills');
      setRows([]);
      setPeerHasRows(false);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    void load(year, month);
  }, [year, month, load]);

  useEffect(() => {
    const onReload = () => {
      void load(year, month);
    };
    window.addEventListener('record-vault-tree-reload', onReload);
    return () => window.removeEventListener('record-vault-tree-reload', onReload);
  }, [year, month, load]);

  const copyFromPeer = async () => {
    if (copyBusy) return;
    setCopyBusy(true);
    setError('');
    try {
      await transferBillSchedule({
        mode: 'copy',
        kind: 'bill_monthly',
        sourceStorageType: peerKey,
        targetStorageType: storageKey
      });
      notifyRecordVaultTreeReload(null);
      await load(year, month);
      setSavedMsg(`Copied Monthly from ${peerLabel}`);
    } catch (err) {
      setError(err?.message || err?.response?.data?.error || 'Copy failed');
    } finally {
      setCopyBusy(false);
    }
  };

  const updateRow = (index, patch) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const merged = { ...r, ...patch };
        if (merged.bill_type === 'Auto') {
          merged.action = null;
          merged.paid_record_id = null;
        }
        return { ...merged, ...computeStatusLocal(merged, year, month) };
      })
    );
    setSavedMsg('');
  };

  const openBillForRow = (row) => {
    setBillEnsurePayload({
      kind: 'monthly',
      year,
      month,
      row_index: Number(row.row_index) || 1,
      monthly_bill_id: row.monthly_bill_id || undefined,
      bill_description: row.bill_description,
      due_day: row.due_day === '' ? null : row.due_day,
      amount: row.amount,
      bill_type: row.bill_type,
      action: row.action
    });
    setBillPopupOpen(true);
  };

  const handleBillChanged = (data) => {
    if (!data?.paidRecordId) return;
    setRows((prev) =>
      prev.map((r) => {
        if (
          (data.monthlyBillId && Number(r.monthly_bill_id) === Number(data.monthlyBillId)) ||
          (Number(r.paid_record_id) === Number(data.paidRecordId)) ||
          (Number(r.row_index) === Number(billEnsurePayload?.row_index) &&
            !r.monthly_bill_id)
        ) {
          return {
            ...r,
            paid_record_id: data.paidRecordId,
            monthly_bill_id: data.monthlyBillId || r.monthly_bill_id,
            has_bill_content: Boolean(data.hasBillContent)
          };
        }
        return r;
      })
    );
  };

  const handleAdd = () => {
    setRows((prev) => {
      const nextIndex = prev.reduce((max, r) => Math.max(max, Number(r.row_index) || 0), 0) + 1;
      return [...prev, blankRow(nextIndex)];
    });
    setSavedMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      const payload = rows.map((r, i) => ({
        row_index: Number(r.row_index) || i + 1,
        bill_description: r.bill_description,
        due_day: r.due_day === '' || r.due_day == null ? null : Number(r.due_day),
        amount: normalizeAmountLocal(r.amount),
        bill_type: r.bill_type === 'Auto' ? 'Auto' : 'Manual',
        action: r.bill_type === 'Auto' ? null : r.action,
        paid_record_id: r.paid_record_id
      }));
      const data = await saveMonthlyBill(year, month, payload, { storageType: storageKey });
      setRows(withDerived(data?.rows || [], year, month));
      setSavedMsg('Saved');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const calendarMarks = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const day = Number(r.due_day);
      if (!Number.isFinite(day) || day < 1) continue;
      const tone = r.status_tone || 'none';
      if (tone === 'none') continue;
      const prev = map.get(day);
      if (!prev || (TONE_RANK[tone] || 0) > (TONE_RANK[prev] || 0)) map.set(day, tone);
    }
    return map;
  }, [rows]);

  const dim = daysInMonth(year, month);
  const startWd = firstWeekday(year, month);
  const today = now;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  // Allow ~3 years back and ~1 year ahead from today; hide arrows at the ends.
  const viewMonthIndex = year * 12 + (month - 1);
  const nowMonthIndex = today.getFullYear() * 12 + today.getMonth();
  const canGoPrevMonth = viewMonthIndex > nowMonthIndex - 36;
  const canGoNextMonth = viewMonthIndex < nowMonthIndex + 12;

  const shiftMonth = (delta) => {
    if (delta < 0 && !canGoPrevMonth) return;
    if (delta > 0 && !canGoNextMonth) return;
    let y = year;
    let m = month + delta;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

  const inputSx = {
    '& .MuiInputBase-input': {
      py: 0.5,
      px: 0.75,
      fontSize: '0.95rem',
      fontFamily: MAIN_FONT_FAMILY,
      color: '#000'
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000' }
  };

  const selectSx = {
    ...inputSx,
    bgcolor: '#fff',
    '& .MuiSelect-select': { py: 0.5, px: 0.75 }
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        bgcolor: '#fff',
        color: '#000',
        fontFamily: MAIN_FONT_FAMILY,
        p: 1.5,
        gap: 1.5
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>Title: Monthly</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#555' }}>
          ({sideLabel})
        </Typography>
        <Box sx={{ flex: 1 }} />
        {canGoPrevMonth ? (
          <Box
            component="button"
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            sx={navBtnSx}
          >
            ‹
          </Box>
        ) : (
          <Box sx={{ width: 36 }} aria-hidden />
        )}
        <Typography sx={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </Typography>
        {canGoNextMonth ? (
          <Box
            component="button"
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            sx={navBtnSx}
          >
            ›
          </Box>
        ) : (
          <Box sx={{ width: 36 }} aria-hidden />
        )}
      </Box>

      {!loading && rows.length === 0 && peerHasRows ? (
        <Box
          sx={{
            flexShrink: 0,
            bgcolor: YELLOW,
            border: '2px solid #000',
            borderRadius: 1,
            p: 1.25,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Typography sx={{ fontWeight: 700, flex: '1 1 200px' }}>
            No Monthly rows on {sideLabel} yet. Your Bill Schedule data is on {peerLabel}.
          </Typography>
          <ColorTemplate13DisableGreenButton
            type="button"
            disabled={copyBusy}
            onClick={() => void copyFromPeer()}
          >
            {copyBusy ? 'Copying…' : `Copy Monthly from ${peerLabel}`}
          </ColorTemplate13DisableGreenButton>
        </Box>
      ) : null}

      {error ? (
        <Typography sx={{ color: RED, fontWeight: 700, flexShrink: 0 }}>{error}</Typography>
      ) : null}
      {savedMsg ? (
        <Typography sx={{ color: '#1b7a3d', fontWeight: 700, flexShrink: 0 }}>{savedMsg}</Typography>
      ) : null}
      {loading ? (
        <Typography sx={{ fontWeight: 600, flexShrink: 0 }}>Loading…</Typography>
      ) : null}

      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          flexShrink: 0,
          '& th, & td': {
            border: '2px solid #000',
            px: 0.75,
            py: 0.5,
            verticalAlign: 'middle',
            fontSize: '0.95rem'
          },
          '& th': { bgcolor: '#e8e8e8', fontWeight: 800, textAlign: 'left' }
        }}
      >
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Bill Description</th>
            <th style={{ width: 88 }}>Due Date</th>
            <th style={{ width: 120 }}>Amount</th>
            <th style={{ width: 72, textAlign: 'center' }}>Bill</th>
            <th style={{ width: 110 }}>Type</th>
            <th style={{ width: 120 }}>Action</th>
            <th style={{ width: 110 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const auto = row.bill_type === 'Auto';
            const typeActionStatusBg = auto ? YELLOW : 'transparent';
            const statusBg = auto ? YELLOW : cellToneBg(row.status_tone);
            return (
              <tr key={`bill-row-${row.row_index}-${index}`}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.row_index}</td>
                <td>
                  <TextField
                    fullWidth
                    size="small"
                    value={row.bill_description}
                    onChange={(e) => updateRow(index, { bill_description: e.target.value })}
                    placeholder="Bill description"
                    sx={inputSx}
                  />
                </td>
                <td>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    inputProps={{ min: 1, max: 31, step: 1 }}
                    value={row.due_day ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') {
                        updateRow(index, { due_day: '' });
                        return;
                      }
                      const n = Math.trunc(Number(v));
                      if (!Number.isFinite(n)) return;
                      updateRow(index, { due_day: Math.min(31, Math.max(1, n)) });
                    }}
                    placeholder="1–31"
                    sx={inputSx}
                  />
                </td>
                <td>
                  <TextField
                    fullWidth
                    size="small"
                    value={row.amount}
                    onChange={(e) => updateRow(index, { amount: e.target.value })}
                    onBlur={() => updateRow(index, { amount: normalizeAmountLocal(row.amount) })}
                    placeholder="$0.00"
                    sx={inputSx}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <BillColumnButton
                    hasContent={Boolean(row.has_bill_content)}
                    disabled={loading || saving}
                    onClick={() => openBillForRow(row)}
                  />
                </td>
                <td style={{ background: typeActionStatusBg }}>
                  <Select
                    fullWidth
                    size="small"
                    value={row.bill_type || 'Manual'}
                    onChange={(e) => updateRow(index, { bill_type: e.target.value })}
                    sx={{ ...selectSx, bgcolor: auto ? YELLOW : '#fff' }}
                  >
                    <MenuItem value="Auto">Auto</MenuItem>
                    <MenuItem value="Manual">Manual</MenuItem>
                  </Select>
                </td>
                <td style={{ background: typeActionStatusBg }}>
                  {auto ? null : (
                    <Select
                      fullWidth
                      size="small"
                      displayEmpty
                      value={row.action || ''}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        updateRow(index, { action: next });
                        if (next === 'Paid') openBillForRow(row);
                      }}
                      sx={selectSx}
                      renderValue={(v) => {
                        if (!v) return <em style={{ opacity: 0.5 }}>Select</em>;
                        return v;
                      }}
                    >
                      <MenuItem value="Not Paid">Not Paid</MenuItem>
                      <MenuItem value="Paid">Paid</MenuItem>
                    </Select>
                  )}
                </td>
                <td
                  style={{
                    background: statusBg,
                    fontWeight: 800,
                    textAlign: 'center',
                    color: row.status_tone === 'overdue' ? '#fff' : '#000'
                  }}
                >
                  {auto ? '' : row.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: 1
        }}
      >
        <ColorTemplate13DisableGreenButton type="button" onClick={handleAdd} disabled={loading || saving}>
          Add
        </ColorTemplate13DisableGreenButton>
        <ColorTemplate13DisableGreenButton type="button" onClick={() => void handleSave()} disabled={loading || saving}>
          {saving ? 'Saving…' : 'SAVE'}
        </ColorTemplate13DisableGreenButton>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          width: '100%',
          maxWidth: 920,
          mx: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          gap: 2
        }}
      >
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: { sm: 520 },
            border: '2px solid #000',
            borderRadius: 1,
            bgcolor: '#fff',
            p: 2.5,
            boxSizing: 'border-box'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              mb: 1.5
            }}
          >
            {canGoPrevMonth ? (
              <Box
                component="button"
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                sx={{ ...navBtnSx, fontSize: '1.75rem', px: 1.25, py: 0.5 }}
              >
                ‹
              </Box>
            ) : (
              <Box sx={{ width: 44 }} aria-hidden />
            )}
            <Typography sx={{ fontWeight: 800, textAlign: 'center', fontSize: '1.5rem', minWidth: 200 }}>
              {MONTH_NAMES[month - 1]} {year}
            </Typography>
            {canGoNextMonth ? (
              <Box
                component="button"
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                sx={{ ...navBtnSx, fontSize: '1.75rem', px: 1.25, py: 0.5 }}
              >
                ›
              </Box>
            ) : (
              <Box sx={{ width: 44 }} aria-hidden />
            )}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 1,
              textAlign: 'center'
            }}
          >
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Typography key={d} sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {d}
              </Typography>
            ))}
            {Array.from({ length: startWd }).map((_, i) => (
              <Box key={`pad-${i}`} />
            ))}
            {Array.from({ length: dim }).map((_, i) => {
              const day = i + 1;
              const tone = calendarMarks.get(day);
              const isToday = isCurrentMonth && today.getDate() === day;
              const upcoming = tone === 'upcoming';
              return (
                <Box
                  key={`day-${day}`}
                  sx={{
                    py: 1.5,
                    borderRadius: upcoming ? '50%' : 1,
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    bgcolor: tone && !upcoming ? cellToneBg(tone) : 'transparent',
                    color: tone === 'overdue' ? '#fff' : '#000',
                    outline: upcoming
                      ? '3px solid #000'
                      : isToday
                        ? `2px solid ${RED}`
                        : 'none',
                    outlineOffset: 1
                  }}
                >
                  {day}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box
          component="aside"
          aria-label="Calendar legend"
          sx={{
            flex: '0 0 auto',
            alignSelf: { xs: 'stretch', sm: 'flex-start' },
            border: '2px solid #000',
            borderRadius: 1,
            bgcolor: '#fff',
            px: 1.75,
            py: 1.5,
            minWidth: { sm: 260 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            boxSizing: 'border-box'
          }}
        >
          {[
            {
              key: 'today',
              label: 'Today Date',
              sample: 26,
              sx: {
                borderRadius: 1,
                bgcolor: 'transparent',
                outline: `2px solid ${RED}`,
                outlineOffset: 0
              }
            },
            {
              key: 'upcoming',
              label: 'Manual Pay Note Due yet',
              sample: 29,
              sx: {
                borderRadius: '50%',
                bgcolor: 'transparent',
                outline: '3px solid #000',
                outlineOffset: 0
              }
            },
            {
              key: 'auto',
              label: 'Auto pay',
              sample: 15,
              sx: {
                borderRadius: 1,
                bgcolor: YELLOW,
                color: '#000'
              }
            },
            {
              key: 'paid',
              label: 'Manual Paid',
              sample: 1,
              sx: {
                borderRadius: 1,
                bgcolor: GREEN,
                color: '#000'
              }
            },
            {
              key: 'overdue',
              label: 'Manual NotPaid Overdue/Late',
              sample: 25,
              sx: {
                borderRadius: 1,
                bgcolor: RED,
                color: '#fff'
              }
            }
          ].map((item) => (
            <Box
              key={item.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  ...item.sx
                }}
              >
                {item.sample}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {billPopupOpen ? (
        <BillReceiptsPopup
          open={billPopupOpen}
          storageType={storageKey}
          ensurePayload={billEnsurePayload}
          onClose={() => {
            setBillPopupOpen(false);
            setBillEnsurePayload(null);
            void load(year, month);
          }}
          onChanged={handleBillChanged}
        />
      ) : null}
    </Box>
  );
}

BillScheduleMonthlyPanel.propTypes = {
  storageType: PropTypes.oneOf(['onedrive', 'usb'])
};
