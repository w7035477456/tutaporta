import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { ensureEmailScanInbox, fetchEmailScanStatus, runEmailScanNow } from 'api/emailScanFe';

const POLL_MS = 5000;

const STAGE_LABEL = {
  added: 'Added — needs Approve',
  duplicate: 'Already in schedule',
  not_bill: 'Not a bill',
  filtered_out: 'Skipped (no bill words)',
  error: 'Could not read'
};

const codeBoxSx = {
  fontFamily: 'monospace',
  fontSize: '0.95rem',
  bgcolor: '#fff',
  color: '#000',
  border: '2px solid #000',
  borderRadius: 1,
  px: 1.25,
  py: 0.75,
  wordBreak: 'break-all',
  userSelect: 'all'
};

function CopyRow({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ ...codeBoxSx, flex: '1 1 260px', minWidth: 0 }} aria-label={label}>
        {value}
      </Box>
      <ColorTemplate7PopupLargeDark.ActionButton onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy'}
      </ColorTemplate7PopupLargeDark.ActionButton>
    </Box>
  );
}

CopyRow.propTypes = {
  value: PropTypes.string.isRequired,
  label: PropTypes.string
};

function formatMoney(n) {
  if (n == null) return '';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AutoScanEmailsPopup({ open, onClose, storageType, onScanFinished }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const wasRunningRef = useRef(false);

  const applyStatus = useCallback(
    (data) => {
      setInfo(data);
      if (wasRunningRef.current && !data?.running) onScanFinished?.();
      wasRunningRef.current = Boolean(data?.running);
    },
    [onScanFinished]
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError('');
    ensureEmailScanInbox({ storageType })
      .then((data) => {
        if (!cancelled) applyStatus(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storageType, applyStatus]);

  useEffect(() => {
    if (!open || !info?.running) return undefined;
    const id = setInterval(() => {
      fetchEmailScanStatus()
        .then(applyStatus)
        .catch((err) => setError(err.message));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [open, info?.running, applyStatus]);

  const startScan = async () => {
    setStarting(true);
    setError('');
    try {
      await runEmailScanNow();
      wasRunningRef.current = true;
      setInfo((prev) => ({ ...(prev || {}), running: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const address = info?.forwarding_address || '';
  const filterWords = info?.gmail_filter_has_words || '';
  const confirm = info?.gmail_confirm;
  const recent = Array.isArray(info?.recent) ? info.recent : [];

  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} bodyTextAlignLeft centerInWindow>
      <ColorTemplate7PopupLargeDark.Title>Auto Scan Emails</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.BodyText>
          Forward your bill, receipt and membership emails to your private TutaMall address. Our local AI
          (on our own server, never a third party) reads each email, finds the company, amount and due date,
          and adds a row to your Bill Schedule outlined in red dashes. Click the green Approve button to keep it.
        </ColorTemplate7PopupLargeDark.BodyText>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {info && !info.configured ? (
          <ColorTemplate7PopupLargeDark.ErrorBar>
            The scan mailbox is not switched on for this server yet. You can still set up Gmail now; emails wait in the
            mailbox until scanning starts.
          </ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}

        <ColorTemplate7PopupLargeDark.SectionTitle>Your private forwarding address</ColorTemplate7PopupLargeDark.SectionTitle>
        {address ? <CopyRow value={address} label="Forwarding address" /> : <Box>Loading…</Box>}

        {confirm ? (
          <>
            <ColorTemplate7PopupLargeDark.SectionTitle>Gmail confirmation code</ColorTemplate7PopupLargeDark.SectionTitle>
            {confirm.code ? <CopyRow value={String(confirm.code)} label="Gmail confirmation code" /> : null}
            {confirm.url ? (
              <ColorTemplate7PopupLargeDark.BodyText>
                Or open the Gmail confirmation link:{' '}
                <a href={confirm.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  confirm forwarding
                </a>
              </ColorTemplate7PopupLargeDark.BodyText>
            ) : null}
          </>
        ) : null}

        <ColorTemplate7PopupLargeDark.SectionTitle>Step 1 — Add the forwarding address in Gmail</ColorTemplate7PopupLargeDark.SectionTitle>
        <ColorTemplate7PopupLargeDark.BodyText>
          In Gmail on a computer: gear icon → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b> →{' '}
          <b>Add a forwarding address</b> → paste the address above → <b>Next</b> → <b>Proceed</b>. Gmail sends a
          confirmation code to that address. Wait about a minute, click <b>Check inbox now</b> below, and the code
          appears in this popup. Enter it in Gmail and click <b>Verify</b>. Leave the top setting on{' '}
          <b>Disable forwarding</b>, so only the filter in Step 2 forwards mail.
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.SectionTitle>Step 2 — Create the filter</ColorTemplate7PopupLargeDark.SectionTitle>
        <ColorTemplate7PopupLargeDark.BodyText>
          In the Gmail search bar click the sliders icon (<b>Show search options</b>). Paste this into{' '}
          <b>Has the words</b>:
        </ColorTemplate7PopupLargeDark.BodyText>
        {filterWords ? <CopyRow value={filterWords} label="Gmail filter Has the words" /> : null}
        <ColorTemplate7PopupLargeDark.BodyText>
          Click <b>Create filter</b> → tick <b>Forward it to</b> → pick your bills+ address → <b>Create filter</b>.
          Gmail only forwards new emails, so bills appear as they arrive. To scan an older bill now, open it in
          Gmail and forward it to the address yourself.
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.SectionTitle>Step 3 — Scan</ColorTemplate7PopupLargeDark.SectionTitle>
        <ColorTemplate7PopupLargeDark.BodyText>
          We check the mailbox every {info?.poll_minutes || 5} minutes. The AI takes about 10 to 60 seconds per email.
          After reading, each email is permanently deleted. We keep only the company, amount and dates.
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <ColorTemplate7PopupLargeDark.ActionButton
            disabled={starting || Boolean(info?.running) || !info?.configured}
            onClick={() => void startScan()}
          >
            {info?.running ? 'Scanning…' : starting ? 'Starting…' : 'Check inbox now'}
          </ColorTemplate7PopupLargeDark.ActionButton>
          {info?.running ? (
            <ColorTemplate7PopupLargeDark.BodyText>Reading emails with local AI — you can close this popup.</ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
        </Box>

        {recent.length ? (
          <>
            <ColorTemplate7PopupLargeDark.SectionTitle>Recent emails</ColorTemplate7PopupLargeDark.SectionTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {recent.map((r) => (
                <li key={r.email_scan_id}>
                  <b>{r.merchant || r.subject || r.from_address || 'Email'}</b>
                  {r.amount != null ? ` ${formatMoney(r.amount)}` : ''}
                  {r.cadence ? ` · ${r.cadence}` : ''}
                  {' — '}
                  {STAGE_LABEL[r.stage] || r.stage}
                </li>
              ))}
            </Box>
          </>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

AutoScanEmailsPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  storageType: PropTypes.string,
  onScanFinished: PropTypes.func
};
