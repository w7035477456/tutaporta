import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { fetchAdminScamAlerts, scanAdminScamConversation, setAdminScamSuspend } from 'api/adminToolsFe';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

const STATUS_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' }
];

const GRID_COLUMNS = '72px 150px 170px 260px 130px 120px 200px minmax(420px, 2fr) 170px';
const TABLE_MIN_WIDTH_PX = 1700;
const BODY_ROW_SX = {
  '& > *': { overflow: 'hidden' },
  '& .MuiTypography-root': { overflowWrap: 'anywhere' }
};

const SUSPEND_OFF_SX = {
  bgcolor: '#9e9e9e !important',
  color: '#ffffff !important',
  borderColor: '#757575 !important'
};

const CATEGORY_LABELS = {
  romance: 'Romance',
  money_request: 'Money request',
  investment: 'Investment',
  crypto: 'Crypto',
  job: 'Fake job',
  marketplace: 'Marketplace',
  prize: 'Prize / grant',
  impersonation: 'Impersonation',
  account_takeover: 'Account takeover',
  loan_fee: 'Loan fee',
  charity: 'Fake charity',
  recovery: 'Funds recovery',
  partnership: 'Fake partnership',
  gift_card: 'Gift card',
  off_platform: 'Off-platform',
  phishing: 'Phishing',
  sextortion: 'Sextortion',
  identity: 'Identity theft',
  other: 'Other'
};

const labelSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.85rem', sm: '0.95rem' },
  color: 'var(--theme-inverse-daynight-color)',
  whiteSpace: 'nowrap'
};

const inputFieldSx = {
  width: 110,
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: 0,
    '& fieldset': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
  },
  '& .MuiInputBase-input': { fontFamily: MAIN_FONT_FAMILY, fontWeight: 600, py: 0.75, px: 1 }
};

const panelSx = {
  width: '100%',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  p: { xs: 1.25, sm: 1.75 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25
};

function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function ProfilePhoto({ singlesId }) {
  if (!singlesId) return <Box sx={{ width: 48, height: 48 }} />;
  return (
    <Box
      component="img"
      src={`${getApiBaseUrl()}/api/profile-photo/${singlesId}`}
      alt=""
      loading="lazy"
      sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--theme-primary-color)' }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

/** Scanned chat as bubbles: scammer on the left (red edge on evidence lines), victim on the right. */
function ConversationCell({ alert }) {
  const scammerId = Number(alert?.scammer?.singles_id);
  const evidenceIds = new Set((alert?.evidence || []).map((e) => Number(e?.msg_id)));
  const lines = Array.isArray(alert?.conversation) ? alert.conversation : [];
  return (
    <Box
      sx={{
        width: '100%',
        maxHeight: 240,
        overflowY: 'auto',
        bgcolor: '#ffffff',
        border: '1px solid var(--theme-primary-color)',
        p: 0.75,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      {lines.map((m) => {
        const fromScammer = Number(m.sender_singles_id) === scammerId;
        const isEvidence = evidenceIds.has(Number(m.msg_id));
        return (
          <Box key={m.msg_id} sx={{ display: 'flex', justifyContent: fromScammer ? 'flex-start' : 'flex-end' }}>
            <Box
              title={`${m.sender_alias || m.sender_singles_id} · ${formatWhen(m.sent_at)}`}
              sx={{
                maxWidth: '85%',
                px: 1,
                py: 0.4,
                borderRadius: '12px',
                bgcolor: fromScammer ? '#e3f2fd' : '#1565c0',
                color: fromScammer ? '#000000' : '#ffffff',
                border: isEvidence ? '2px solid #d32f2f' : '1px solid var(--theme-primary-color)',
                fontSize: '0.78rem',
                lineHeight: 1.3,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {m.text}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function AdminToolsScamAlertTab({ onError }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAlertId, setBusyAlertId] = useState(null);
  const [scanA, setScanA] = useState('');
  const [scanB, setScanB] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState('');

  const load = useCallback(
    async (status = statusFilter) => {
      setLoading(true);
      onError?.('');
      try {
        setAlerts(await fetchAdminScamAlerts(status));
      } catch (err) {
        setAlerts([]);
        onError?.(err?.response?.data?.error || err?.message || 'Failed to load scam alerts');
      } finally {
        setLoading(false);
      }
    },
    [onError, statusFilter]
  );

  useEffect(() => {
    void load(statusFilter);
  }, [statusFilter, load]);

  const toggleSuspend = useCallback(
    async (alert, suspend) => {
      setBusyAlertId(alert.scam_alert_id);
      onError?.('');
      try {
        await setAdminScamSuspend({
          singlesId: alert.scammer.singles_id,
          suspend,
          scamAlertId: alert.scam_alert_id
        });
        await load();
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to update suspend');
      } finally {
        setBusyAlertId(null);
      }
    },
    [load, onError]
  );

  const runScan = useCallback(async () => {
    setScanBusy(true);
    setScanResult('');
    onError?.('');
    try {
      const r = await scanAdminScamConversation(Number(scanA), Number(scanB));
      const v = r?.verdict;
      const alertIds = (r?.alerts || []).map((a) => `#${a.scam_alert_id}`).join(', ');
      setScanResult(
        v
          ? `${v.is_scam ? 'Scam' : 'Not a scam'} — risk ${v.risk_score}${alertIds ? ` — alert ${alertIds}` : ''}. ${v.reason || ''}`
          : `No scan (${r?.skipped || 'unknown'})`
      );
      await load();
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Scam scan failed');
    } finally {
      setScanBusy(false);
    }
  }, [load, onError, scanA, scanB]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <Box sx={panelSx}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          {STATUS_FILTERS.map((f) => {
            const Btn = statusFilter === f.value ? SelectedButtonTemplate : UnSelectedButtonTemplate;
            return (
              <Btn key={f.label} type="button" disabled={loading} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </Btn>
            );
          })}
          <SelectedButtonTemplate type="button" disabled={loading} onClick={() => void load()}>
            {loading ? 'Loading…' : 'Refresh'}
          </SelectedButtonTemplate>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography sx={labelSx}>Scan chat now — singles_id:</Typography>
          <TextField
            size="small"
            value={scanA}
            onChange={(e) => setScanA(e.target.value.replace(/\D/g, ''))}
            inputProps={{ inputMode: 'numeric' }}
            sx={inputFieldSx}
          />
          <Typography sx={labelSx}>and</Typography>
          <TextField
            size="small"
            value={scanB}
            onChange={(e) => setScanB(e.target.value.replace(/\D/g, ''))}
            inputProps={{ inputMode: 'numeric' }}
            sx={inputFieldSx}
          />
          <SelectedButtonTemplate
            type="button"
            disabled={scanBusy || !scanA || !scanB || scanA === scanB}
            onClick={() => void runScan()}
          >
            {scanBusy ? 'Scanning…' : 'Scan'}
          </SelectedButtonTemplate>
        </Box>
        {scanResult ? <ColorTemplate9TableData.BodyText>{scanResult}</ColorTemplate9TableData.BodyText> : null}
      </Box>

      {!loading && !alerts.length ? (
        <ColorTemplate9TableData.EmptyText>No scam alerts.</ColorTemplate9TableData.EmptyText>
      ) : null}
      {alerts.length ? (
        <ColorTemplate9TableData.Table topHorizontalScrollbar minTableWidth={TABLE_MIN_WIDTH_PX}>
          <ColorTemplate9TableData.HeaderRow gridTemplateColumns={GRID_COLUMNS}>
            <ColorTemplate9TableData.HeaderCell>Photo</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Category</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Alias</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Email</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>singles_id</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>member_id</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>AI verdict</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Conversation (scammer left, victim right)</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Status</ColorTemplate9TableData.HeaderCell>
          </ColorTemplate9TableData.HeaderRow>
          {alerts.map((a, index) => (
            <ColorTemplate9TableData.BodyRow key={a.scam_alert_id} rowIndex={index} gridTemplateColumns={GRID_COLUMNS} sx={BODY_ROW_SX}>
              <ColorTemplate9TableData.BodyCell>
                <ProfilePhoto singlesId={a.scammer.singles_id} />
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{a.scammer.member_category || '—'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={{ fontWeight: 700 }}>{a.scammer.alias || '—'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={{ wordBreak: 'break-all' }}>
                  {a.scammer.email || '—'}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{a.scammer.singles_id || '—'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{a.scammer.member_id ?? '—'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <ColorTemplate9TableData.BodyText sx={{ fontWeight: 800, color: '#d32f2f !important' }}>
                  Risk {a.risk_score} · {CATEGORY_LABELS[a.category] || a.category}
                </ColorTemplate9TableData.BodyText>
                <ColorTemplate9TableData.BodyText sx={{ fontSize: '0.78rem' }}>{a.reason}</ColorTemplate9TableData.BodyText>
                <ColorTemplate9TableData.BodyText sx={{ fontSize: '0.72rem', opacity: 0.85 }}>
                  Victim: {a.victim.alias || '—'} (#{a.victim.singles_id}
                  {a.victim.member_id ? `, M${a.victim.member_id}` : ''})
                </ColorTemplate9TableData.BodyText>
                <ColorTemplate9TableData.BodyText sx={{ fontSize: '0.72rem', opacity: 0.85 }}>
                  {formatWhen(a.created_at)} · seen {a.detection_count}×
                  {a.victim_first_seen_at ? ' · victim warned' : ' · victim not warned yet'}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ConversationCell alert={a} />
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ flexDirection: 'column', gap: 0.75, alignItems: 'stretch' }}>
                {a.scammer.suspend_locked ? (
                  <SelectedButtonTemplate
                    type="button"
                    title="Suspend is ON: status is pinned to suspend. Click to release."
                    disabled={busyAlertId === a.scam_alert_id}
                    onClick={() => void toggleSuspend(a, false)}
                  >
                    Suspend
                  </SelectedButtonTemplate>
                ) : (
                  <UnSelectedButtonTemplate
                    type="button"
                    title="Suspend is OFF: status follows code / Lookup. Click to force suspend."
                    disabled={busyAlertId === a.scam_alert_id}
                    onClick={() => void toggleSuspend(a, true)}
                    sx={SUSPEND_OFF_SX}
                  >
                    Suspend
                  </UnSelectedButtonTemplate>
                )}
                <ColorTemplate9TableData.BodyText sx={{ fontSize: '0.72rem', opacity: 0.85 }}>
                  status: {a.scammer.status || 'blank'}
                  {a.scammer.suspend_locked ? ' (locked)' : ''}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
            </ColorTemplate9TableData.BodyRow>
          ))}
        </ColorTemplate9TableData.Table>
      ) : null}
    </Box>
  );
}
