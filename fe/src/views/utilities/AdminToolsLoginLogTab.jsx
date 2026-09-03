import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { fetchAdminLoginLogLookup, fetchAdminLoginLogLookupAll } from 'api/adminToolsFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { truncateColorTemplate9AutoFitText } from 'utils/colorTemplate9AutoFitColumns';

const LOOKUP_COLUMN_DISPLAY_CHARS = 36;

const MIN_LOGIN_LOG_COLUMN_WIDTHS_PX = Object.freeze([72, 160, 88, 88, 180, 120]);

const labelSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.85rem', sm: '0.95rem' },
  color: 'var(--theme-inverse-daynight-color)',
  whiteSpace: 'nowrap',
  flexShrink: 0
};

const inputFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: 0,
    '& fieldset': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 },
    '&:hover fieldset': { borderColor: 'var(--theme-primary-color)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--theme-primary-color)' }
  },
  '& .MuiInputBase-input': {
    fontFamily: MAIN_FONT_FAMILY,
    fontWeight: 600,
    py: 0.75,
    px: 1
  }
};

const bigOrSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '0.95rem', sm: '1.05rem' },
  color: 'var(--theme-primary-color)',
  px: 0.25,
  flexShrink: 0
};

const lookupPanelSx = {
  width: '100%',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  p: { xs: 1.25, sm: 1.75 },
  bgcolor: 'transparent'
};

const lookupBodyTextSx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%'
};

const lookupCenterColumnCellSx = {
  display: { xs: 'none', sm: 'flex' },
  justifyContent: 'center',
  overflow: 'hidden'
};

const sectionTitleSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '1rem', sm: '1.1rem' },
  color: 'var(--theme-inverse-daynight-color)',
  mb: 0.75
};

function truncateLookupDisplay(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return truncateColorTemplate9AutoFitText(text, LOOKUP_COLUMN_DISPLAY_CHARS);
}

function formatLoginAt(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

/** Privacy: show only last IP digit as x.x.x.# (e.g. x.x.x.5). */
function formatLoginLogIp(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^x\.x\.x\.[0-9]$/i.test(text)) return text.toLowerCase();
  const lastOctet = text.includes('.') ? text.split('.').pop() : text;
  const digits = String(lastOctet ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `x.x.x.${digits.slice(-1)}`;
}

function hasLoginLogInput({ typeInput, singlesIdInput, emailInput, phoneInput, ipInput }) {
  return Boolean(
    String(typeInput ?? '').trim() ||
      String(singlesIdInput ?? '').trim() ||
      String(emailInput ?? '').trim() ||
      String(phoneInput ?? '').trim() ||
      String(ipInput ?? '').trim()
  );
}

function LookupField({ label, value, onChange, inputMode, pattern }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 140px', minWidth: 0 }}>
      <Typography sx={labelSx}>{label}</Typography>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={inputMode ? { inputMode, pattern } : undefined}
        size="small"
        fullWidth
        autoComplete="off"
        sx={inputFieldSx}
      />
    </Box>
  );
}

function buildLoginLogColumnTexts(rows) {
  return [
    ['Type', ...rows.map((row) => truncateLookupDisplay(row.typeLabel || '—'))],
    ['Time', ...rows.map((row) => truncateLookupDisplay(formatLoginAt(row.loginAt)))],
    ['singles_id', ...rows.map((row) => truncateLookupDisplay(row.singlesId ?? '—'))],
    ['member_id', ...rows.map((row) => truncateLookupDisplay(row.memberId ?? '—'))],
    ['Email', ...rows.map((row) => truncateLookupDisplay(row.email || '—'))],
    ['IP (x.x.x.#)', ...rows.map((row) => truncateLookupDisplay(formatLoginLogIp(row.clientIp) || '—'))]
  ];
}

export default function AdminToolsLoginLogTab({ onError }) {
  const [typeInput, setTypeInput] = useState('');
  const [singlesIdInput, setSinglesIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [rows, setRows] = useState([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupAllBusy, setLookupAllBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const columnTexts = useMemo(() => buildLoginLogColumnTexts(rows), [rows]);
  const { gridTemplateColumns, minTableWidthPx } = useColorTemplate9AutoFitColumnWidths({
    columnTexts,
    minWidthsPx: MIN_LOGIN_LOG_COLUMN_WIDTHS_PX,
    maxMeasureChars: LOOKUP_COLUMN_DISPLAY_CHARS,
    enabled: rows.length > 0
  });

  const lookupPayload = useCallback(
    () => ({
      type: String(typeInput ?? '').trim() || undefined,
      singlesId: String(singlesIdInput ?? '').trim() || undefined,
      email: String(emailInput ?? '').trim() || undefined,
      phone: String(phoneInput ?? '').trim() || undefined,
      ip: String(ipInput ?? '').trim() || undefined
    }),
    [emailInput, ipInput, phoneInput, singlesIdInput, typeInput]
  );

  const handleLookupClick = useCallback(async () => {
    if (!hasLoginLogInput({ typeInput, singlesIdInput, emailInput, phoneInput, ipInput })) {
      setHasSearched(false);
      setRows([]);
      onError?.('');
      return;
    }
    setHasSearched(true);
    setLookupBusy(true);
    onError?.('');
    try {
      const data = await fetchAdminLoginLogLookup(lookupPayload());
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setRows([]);
      onError?.(err?.response?.data?.error || err?.message || 'Failed to lookup login log');
    } finally {
      setLookupBusy(false);
    }
  }, [emailInput, ipInput, lookupPayload, onError, phoneInput, singlesIdInput, typeInput]);

  const handleLookupAllClick = useCallback(async () => {
    setHasSearched(true);
    setLookupAllBusy(true);
    onError?.('');
    try {
      const data = await fetchAdminLoginLogLookupAll();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setRows([]);
      onError?.(err?.response?.data?.error || err?.message || 'Failed to lookup all login log rows');
    } finally {
      setLookupAllBusy(false);
    }
  }, [onError]);

  const handleClearClick = useCallback(() => {
    setTypeInput('');
    setSinglesIdInput('');
    setEmailInput('');
    setPhoneInput('');
    setIpInput('');
    setRows([]);
    setHasSearched(false);
    onError?.('');
  }, [onError]);

  const listBusy = lookupBusy || lookupAllBusy;
  const hasInput = hasLoginLogInput({ typeInput, singlesIdInput, emailInput, phoneInput, ipInput });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch', width: '100%' }}>
      <Box sx={lookupPanelSx}>
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.25 }}>
          <SelectedButtonTemplate type="button" disabled={listBusy} onClick={() => void handleLookupAllClick()}>
            {lookupAllBusy ? 'Loading all…' : 'Lookup All'}
          </SelectedButtonTemplate>
        </Box>

        {!listBusy && !hasSearched ? (
          <ColorTemplate9TableData.EmptyText sx={{ pb: 1.25 }}>
            Enter Type (Demo / Signup), ID, Email, Number, or IP, then press Lookup. Use * as a wildcard.
          </ColorTemplate9TableData.EmptyText>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.25, md: 1.5 }
          }}
        >
          <LookupField label="Type:" value={typeInput} onChange={setTypeInput} />
          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>
          <LookupField
            label="ID:"
            value={singlesIdInput}
            onChange={(value) => setSinglesIdInput(value.replace(/[^\d*]/g, ''))}
            inputMode="numeric"
            pattern="[0-9*]*"
          />
          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>
          <LookupField label="Email:" value={emailInput} onChange={setEmailInput} />
          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>
          <LookupField label="Number:" value={phoneInput} onChange={setPhoneInput} />
          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>
          <LookupField label="IP:" value={ipInput} onChange={setIpInput} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', pt: 1.5 }}>
          <SelectedButtonTemplate type="button" disabled={listBusy} onClick={handleClearClick}>
            Clear
          </SelectedButtonTemplate>
          <SelectedButtonTemplate
            type="button"
            disabled={listBusy || !hasInput}
            onClick={() => void handleLookupClick()}
          >
            {lookupBusy ? 'Searching…' : 'Lookup'}
          </SelectedButtonTemplate>
        </Box>
      </Box>

      {!listBusy && hasSearched ? (
        <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'visible' }}>
          <Typography sx={sectionTitleSx}>
            login_log{rows.length ? ` (${rows.length})` : ''}
          </Typography>
          {!rows.length ? (
            <ColorTemplate9TableData.EmptyText>No matching login_log rows.</ColorTemplate9TableData.EmptyText>
          ) : (
              <ColorTemplate9TableData.Table
                topHorizontalScrollbar
                autoFitColumns
                minTableWidth={minTableWidthPx}
              >
                <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
                  <ColorTemplate9TableData.HeaderCell>Type</ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    Time
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    singles_id
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    member_id
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    Email
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    IP (x.x.x.#)
                  </ColorTemplate9TableData.HeaderCell>
                </ColorTemplate9TableData.HeaderRow>
                {rows.map((row, index) => (
                  <ColorTemplate9TableData.BodyRow
                    key={row.loginLogId ?? `${row.singlesId}-${index}`}
                    rowIndex={index}
                    gridTemplateColumns={gridTemplateColumns}
                  >
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(row.typeLabel || '—')}
                      </ColorTemplate9TableData.BodyText>
                      <ColorTemplate9TableData.BodyText
                        sx={{ display: { xs: 'block', sm: 'none' }, opacity: 0.85, mt: 0.25 }}
                      >
                        {formatLoginAt(row.loginAt)} · {row.email || '—'} · {formatLoginLogIp(row.clientIp) || '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(formatLoginAt(row.loginAt))}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(row.singlesId ?? '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(row.memberId ?? '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(row.email || '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(formatLoginLogIp(row.clientIp) || '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                  </ColorTemplate9TableData.BodyRow>
                ))}
              </ColorTemplate9TableData.Table>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
