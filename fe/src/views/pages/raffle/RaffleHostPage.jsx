import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import jsQR from 'jsqr';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import tutaMallParkinglot from 'assets/images/tutaMallParkinglot.png';
import { drawRaffleHostWinner, fetchRaffleHostEvents, loginRaffleHost, verifyRaffleHostTicket } from 'api/raffleHostFe';

const SCAN_MAX_EDGE_PX = 1600;
const VERIFY_CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

function apiErrorMessage(err, fallback) {
  return String(err?.response?.data?.error || '').trim() || fallback;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not open the photo.'));
    };
    img.src = url;
  });
}

function decodeQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tryAt = (w, h) => {
    const data = ctx.getImageData(0, 0, w, h);
    return jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
  };
  const full = tryAt(canvas.width, canvas.height);
  if (full?.data) return full.data;
  // Large phone photos: a smaller copy often decodes when the full one does not.
  const small = document.createElement('canvas');
  const scale = 800 / Math.max(canvas.width, canvas.height);
  if (scale >= 1) return '';
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const data = sctx.getImageData(0, 0, small.width, small.height);
  return jsQR(data.data, small.width, small.height, { inversionAttempts: 'attemptBoth' })?.data || '';
}

/** Phone photo → { qrText, jpegBlob, previewUrl } (resized so uploads stay small). */
async function processScanPhoto(file) {
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, SCAN_MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const qrText = decodeQrFromCanvas(canvas);
    const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return { qrText, jpegBlob, previewUrl: jpegBlob ? URL.createObjectURL(jpegBlob) : '' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sectionSx = {
  border: '3px solid #111',
  borderRadius: 2,
  p: { xs: 1.5, sm: 2 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5
};

const labelSx = { fontWeight: 800, fontSize: { xs: '1.25rem', sm: '1.4rem' }, color: '#111', flexShrink: 0 };

const fieldSx = {
  flex: 1,
  minWidth: 0,
  height: 46,
  fontSize: 16,
  px: 1.25,
  border: '1px solid #888',
  borderRadius: 1,
  bgcolor: '#fff',
  color: '#111',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const pillButtonSx = {
  borderRadius: '999px',
  fontWeight: 800,
  fontSize: { xs: '1.2rem', sm: '1.4rem' },
  px: 3,
  py: 0.75,
  border: '2px solid #111',
  width: { xs: '100%', sm: 'auto' },
  alignSelf: 'center',
  '&:not(.Mui-disabled)': { bgcolor: '#5cc84a !important', color: '#111 !important' },
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': { bgcolor: '#4cb53b !important' }
  }
};

function FieldRow({ label, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography component="label" sx={{ ...labelSx, width: { xs: 118, sm: 150 } }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

FieldRow.propTypes = {
  label: PropTypes.node.isRequired,
  children: PropTypes.node
};

function ResultBox({ result }) {
  if (!result) return null;
  const bg = result.status === 'valid' ? '#5cc84a' : result.status === 'already_claimed' ? '#ff9800' : '#e60000';
  return (
    <Box sx={{ bgcolor: bg, color: '#111', border: '2px solid #111', borderRadius: 1, p: 1.25, textAlign: 'center' }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{result.message}</Typography>
      {result.memberName ? <Typography sx={{ fontWeight: 700 }}>Ticket holder: {result.memberName}</Typography> : null}
      {result.verifyCode ? <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>Code {result.verifyCode}</Typography> : null}
    </Box>
  );
}

ResultBox.propTypes = {
  result: PropTypes.shape({
    status: PropTypes.string,
    message: PropTypes.string,
    memberName: PropTypes.string,
    verifyCode: PropTypes.string
  })
};

/** tutamall.com/vr — Meetup host: pick event + host password, draw winning numbers, verify the winner's ticket. */
export default function RaffleHostPage() {
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState('');
  const [eventId, setEventId] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [winNumber, setWinNumber] = useState(null);
  const [counts, setCounts] = useState(null);
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawError, setDrawError] = useState('');
  const [code, setCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const drawingClosed = (counts?.claimed ?? 0) > 0;
  const canVerify = winNumber != null;
  const fileInputRef = useRef(null);
  const lastAutoCodeRef = useRef('');

  useEffect(() => {
    fetchRaffleHostEvents()
      .then(setEvents)
      .catch((err) => setEventsError(apiErrorMessage(err, 'Could not load events. Please refresh.')));
  }, []);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const resetHost = () => {
    setHost(null);
    setWinNumber(null);
    setCounts(null);
    setDrawError('');
    setVerifyResult(null);
    setVerifyError('');
    setCode('');
    lastAutoCodeRef.current = '';
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (loginBusy) return;
    setLoginError('');
    if (!eventId) return setLoginError('Please select your event.');
    if (!password) return setLoginError('Please enter your host password.');
    setLoginBusy(true);
    try {
      const data = await loginRaffleHost(Number(eventId), password);
      setHost(data);
      setCounts({ issued: data.issued, drawn: data.drawn, claimed: data.claimed });
    } catch (err) {
      resetHost();
      setLoginError(apiErrorMessage(err, 'Could not check the host password.'));
    } finally {
      setLoginBusy(false);
    }
  };

  const handleDraw = async () => {
    if (!host || drawBusy) return;
    setDrawBusy(true);
    setDrawError('');
    setVerifyResult(null);
    setVerifyError('');
    try {
      const data = await drawRaffleHostWinner(host.eventId, password, winNumber);
      setWinNumber(data.raffleNumber);
      setCounts({ issued: data.issued, drawn: data.drawn, claimed: data.claimed });
    } catch (err) {
      const data = err?.response?.data;
      if (data?.closed) setCounts({ issued: data.issued, drawn: data.drawn, claimed: data.claimed });
      else setDrawError(apiErrorMessage(err, 'Could not draw a raffle number.'));
    } finally {
      setDrawBusy(false);
    }
  };

  const runVerify = async ({ verifyCode, source, imageBlob }) => {
    if (!host) return;
    setVerifyBusy(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const data = await verifyRaffleHostTicket({
        eventId: host.eventId,
        password,
        winNumber,
        code: verifyCode,
        source,
        imageBlob
      });
      setVerifyResult(data);
      setCounts({ issued: data.issued, drawn: data.drawn, claimed: data.claimed });
    } catch (err) {
      setVerifyError(apiErrorMessage(err, 'Could not verify the ticket.'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleScanFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !host) return;
    setVerifyError('');
    setVerifyResult(null);
    try {
      const { qrText, jpegBlob, previewUrl: nextPreview } = await processScanPhoto(file);
      setPreviewUrl(nextPreview);
      await runVerify({ verifyCode: qrText, source: 'scan', imageBlob: jpegBlob });
    } catch (err) {
      setVerifyError(err?.message || 'Could not read the photo.');
    }
  };

  const handleCodeChange = (e) => {
    const cleaned = e.target.value.toUpperCase().replace(VERIFY_CODE_CHARS, '').slice(0, 8);
    const display = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
    setCode(display);
    if (cleaned.length === 8 && cleaned !== lastAutoCodeRef.current && !verifyBusy) {
      lastAutoCodeRef.current = cleaned;
      void runVerify({ verifyCode: cleaned, source: 'code' });
    }
  };

  const handleCodeKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const cleaned = code.replace(/-/g, '');
    if (cleaned.length === 8) {
      lastAutoCodeRef.current = cleaned;
      void runVerify({ verifyCode: cleaned, source: 'code' });
    } else {
      setVerifyError('Verification code must be 8 letters/numbers (like K7Q4-MZ9X).');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        backgroundImage: `url(${tutaMallParkinglot})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: { xs: 'scroll', md: 'fixed' },
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        px: { xs: 1, sm: 2 },
        py: { xs: 1.5, sm: 3 },
        boxSizing: 'border-box'
      }}
    >
      <Box
        sx={{
          width: 'min(480px, 100%)',
          bgcolor: '#ffe01b',
          border: '3px solid #111',
          borderRadius: 2,
          p: { xs: 1, sm: 1.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.25, sm: 1.5 },
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          '&& .MuiTypography-root': { color: 'var(--rh-color, #111) !important' }
        }}
      >
        <Box
          sx={{
            bgcolor: '#dfe5ea',
            border: '2px solid #555',
            p: { xs: 1.25, sm: 1.5 },
            fontFamily: '"Times New Roman", Times, serif',
            color: '#111',
            fontSize: { xs: '0.98rem', sm: '1.02rem' },
            lineHeight: 1.35
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 0.75, letterSpacing: 1 }}>— — — — Event Host — — — —</Box>
          <Box component="ol" sx={{ m: 0, pl: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <li>Select Event title and enter your Host password</li>
            <li>
              Tap <b>Generate Winning Raffle</b> and announce the raffle number out loud.
            </li>
            <li>If the winner comes forward in person, go to the verification step below.</li>
            <li>
              If no one claims the prize within 30 seconds, tap <b>Generate Winning Raffle</b> again. Repeat until a winner comes forward.
            </li>
            <li>
              Tap <b>Scan</b> and scan the winner&apos;s raffle ticket. It can be a paper ticket or one shown on their phone. Can&apos;t
              scan? Enter the 8-character verification code printed on the ticket instead.
            </li>
          </Box>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={sectionSx}>
          <FieldRow label="Event">
            <Box
              component="select"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setPassword('');
                setPreviewUrl('');
                resetHost();
                setLoginError('');
              }}
              sx={fieldSx}
            >
              <option value="">↓ Select your event</option>
              {events.map((ev) => (
                <option key={ev.eventId} value={String(ev.eventId)}>
                  {ev.title}
                  {ev.hostName ? ` (${ev.hostName})` : ''}
                </option>
              ))}
            </Box>
          </FieldRow>
          {!host ? (
            <FieldRow label="Host password">
              <Box
                component="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={fieldSx}
              />
            </FieldRow>
          ) : null}
          {eventsError ? (
            <Typography sx={{ '--rh-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{eventsError}</Typography>
          ) : null}
          {loginError ? <Typography sx={{ '--rh-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{loginError}</Typography> : null}
          {!host ? (
            <ColorTemplate13DisableGreenButton type="submit" hoverEnlargeFont disabled={loginBusy} sx={pillButtonSx}>
              {loginBusy ? 'Checking…' : 'Submit'}
            </ColorTemplate13DisableGreenButton>
          ) : null}
        </Box>

        {host ? (
          <>
            <Box sx={sectionSx}>
              <ColorTemplate13DisableGreenButton
                type="button"
                hoverEnlargeFont
                disabled={drawBusy || drawingClosed}
                onClick={() => void handleDraw()}
                sx={pillButtonSx}
              >
                {drawBusy ? 'Drawing…' : 'Generate Raffle win#'}
              </ColorTemplate13DisableGreenButton>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <Typography sx={labelSx}>Raffle Win #</Typography>
                <Box
                  sx={{
                    bgcolor: '#e60000',
                    color: '#111',
                    minWidth: 150,
                    px: 2,
                    py: 1,
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: { xs: '2rem', sm: '2.3rem' },
                    lineHeight: 1.1
                  }}
                >
                  {winNumber ?? '—'}
                </Box>
              </Box>
              {drawingClosed ? (
                <Typography sx={{ '--rh-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>
                  Winner verified — drawing is closed for this event.
                </Typography>
              ) : drawError ? (
                <Typography sx={{ '--rh-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{drawError}</Typography>
              ) : null}
            </Box>

            <Box sx={sectionSx}>
              <Box
                component="input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleScanFile(e)}
                sx={{ display: 'none' }}
              />
              <ColorTemplate13DisableGreenButton
                type="button"
                hoverEnlargeFont
                disabled={verifyBusy || !canVerify}
                onClick={() => fileInputRef.current?.click()}
                sx={pillButtonSx}
              >
                {verifyBusy ? 'Verifying…' : 'Scan winner Raffle'}
              </ColorTemplate13DisableGreenButton>
              <Typography sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', mt: -0.75 }}>OR</Typography>
              <FieldRow label="Verification Code">
                <Box
                  component="input"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="K7Q4-MZ9X"
                  value={code}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  disabled={verifyBusy || !canVerify}
                  sx={{
                    ...fieldSx,
                    fontFamily: 'monospace',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    '&:disabled': { bgcolor: '#9e9e9e', borderColor: '#777', cursor: 'not-allowed' }
                  }}
                />
              </FieldRow>
              {verifyBusy ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={26} />
                </Box>
              ) : null}
              {verifyError ? (
                <Typography sx={{ '--rh-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{verifyError}</Typography>
              ) : null}
              <ResultBox result={verifyResult} />
              {previewUrl ? (
                <Box
                  component="img"
                  src={previewUrl}
                  alt="Scanned raffle ticket"
                  sx={{ display: 'block', maxWidth: '100%', maxHeight: 220, mx: 'auto', border: '2px solid #111', borderRadius: 1 }}
                />
              ) : null}
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
