import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { raffleButtonColorSx } from 'config/raffleButtonColors';
import GetMyRafflePopup, { RaffleTicketCard } from 'ui-component/GetMyRafflePopup';
import RaffleEventSelect from 'ui-component/RaffleEventSelect';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
import getMyRaffleTicketImg from 'assets/images/getmyraffleticket.png';
import rafflesBannerImg from 'assets/images/rafflesbanner.png';
import { fetchRaffleState, submitRafflePayout } from 'api/raffleFe';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const PANEL_YELLOW = '#ffe01b';
/** Never narrower than the Get My Raffle Ticket image + placeholders. */
const PANEL_MIN_PX = 340;
/** Everything around the event text: panel border + padding (26), label column + gap (64), input padding + × / ▾ (84). */
const PANEL_CHROME_PX = 174;

const fieldSx = {
  height: 36,
  minWidth: 0,
  fontSize: 15,
  px: 1,
  bgcolor: '#fff',
  color: '#111',
  border: '1px solid #888',
  borderRadius: 1,
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const pillSx = {
  whiteSpace: 'nowrap',
  fontWeight: 800,
  fontSize: { xs: '1.05rem', sm: '1.2rem' },
  px: 2.5,
  alignSelf: 'center',
  ...raffleButtonColorSx
};

function apiErrorMessage(err, fallback) {
  return String(err?.response?.data?.error || '').trim() || fallback;
}

function formatWhen(value, timeZone) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone, timeZoneName: 'short' });
  } catch {
    return new Date(value).toLocaleString();
  }
}

/** 8/15/2026 in the event's own time zone ('' when the event has no date). */
function formatEventDate(value, timeZone) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-US', { timeZone });
  } catch {
    return new Date(value).toLocaleDateString('en-US');
  }
}

/** Earliest event first; events without a date last. */
function byEventDateAsc(a, b) {
  const ta = a.nightDatetime ? new Date(a.nightDatetime).getTime() : Infinity;
  const tb = b.nightDatetime ? new Date(b.nightDatetime).getTime() : Infinity;
  return ta - tb || a.eventId - b.eventId;
}

/** "10/16/2026 Singles Mingle @ Mad Oak…" */
function eventOption(ev) {
  const date = formatEventDate(ev.nightDatetime, ev.timeZone);
  return { value: String(ev.eventId), label: `${date ? `${date} ` : ''}${ev.title || ev.label}` };
}

const WINNING_RED = '#d50000';
const winningText = (raffleNumber) =>
  Array.from({ length: 12 }, () => `Winning Ticket${raffleNumber ? ` ${raffleNumber}` : ''}`).join(' \u2605 ');

const winningStripSx = {
  position: 'absolute',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  fontWeight: 900,
  fontSize: '0.8rem',
  lineHeight: '20px',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  '--mr-color': '#fff',
  bgcolor: WINNING_RED
};

const winningFrameSx = {
  position: 'relative',
  p: '20px',
  bgcolor: WINNING_RED,
  borderRadius: 1,
  '@keyframes winningRaffleBlink': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.1 }
  },
  '& .winning-raffle-text': { animation: 'winningRaffleBlink 0.5s steps(1, end) infinite' },
  '@media (prefers-reduced-motion: reduce)': { '& .winning-raffle-text': { animation: 'none' } }
};

/** Ticket card framed on all four sides by rapidly blinking "WINNING TICKET ###" text. */
function WinningRaffleFrame({ raffleNumber, children }) {
  const text = <span className="winning-raffle-text">{winningText(raffleNumber)}</span>;
  return (
    <Box sx={winningFrameSx}>
      <Typography sx={{ ...winningStripSx, top: 0, left: 0, right: 0, height: 20 }}>{text}</Typography>
      <Typography sx={{ ...winningStripSx, bottom: 0, left: 0, right: 0, height: 20 }}>{text}</Typography>
      <Typography
        sx={{ ...winningStripSx, top: 20, bottom: 20, left: 0, width: 20, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {text}
      </Typography>
      <Typography sx={{ ...winningStripSx, top: 20, bottom: 20, right: 0, width: 20, writingMode: 'vertical-rl' }}>{text}</Typography>
      {children}
    </Box>
  );
}

WinningRaffleFrame.propTypes = { raffleNumber: PropTypes.number, children: PropTypes.node };

const CLAIM_BLUE = '#8fd3f5';

/** raffle_user.raffle_status = WINVERIFIED — host verified, PayPal / Venmo not submitted yet. */
const isPrizePending = (t) => t?.status === 'WINVERIFIED';

/**
 * WINVERIFIED (host scanned the winning ticket): blue "Claim your $N prize" PayPal / Venmo form under the ticket,
 * framed by the blinking WINNING TICKET border. Submit → CLAIMED and the panel switches to "Raffle Prize Claimed".
 * × hides it behind a "Claim My Raffle Prize" button; a refresh shows it again.
 */
function ClaimPrizeSection({ event, ticket, prizeDollars, onSubmitted }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <ColorTemplate13DisableGreenButton type="button" hoverEnlargeFont onClick={() => setOpen(true)} sx={pillSx}>
        Claim My Raffle Prize
      </ColorTemplate13DisableGreenButton>
    );
  }
  return (
    <WinningRaffleFrame raffleNumber={ticket.raffleNumber}>
      <Box sx={{ bgcolor: CLAIM_BLUE, borderRadius: 1, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.15rem', sm: '1.3rem' }, textAlign: 'center', px: 5 }}>
            Claim your ${prizeDollars} prize
          </Typography>
          <ColorTemplate6CloseX
            aria-label="Close claim prize"
            positionSx={{ position: 'absolute', top: 0, right: 0 }}
            onClose={() => setOpen(false)}
          />
        </Box>
        <PayoutForm event={event} ticket={ticket} prizeDollars={prizeDollars} onSubmitted={onSubmitted} />
      </Box>
    </WinningRaffleFrame>
  );
}

/** Won the draw but the host has not scanned / typed the code yet. */
function AwaitingHostVerifyNote({ prizeDollars }) {
  return (
    <Typography sx={{ fontWeight: 500, textAlign: 'center', lineHeight: 1.35 }}>
      <b>Your number was drawn!</b> Show this ticket to the host within 10 seconds to be scanned. Once the host confirms your ticket is
      valid, a <b>&ldquo;Claim My Raffle Prize&rdquo;</b> button will appear here. Tap it to enter your info, and we&rsquo;ll send{' '}
      {`your $${prizeDollars}`} by PayPal or Venmo, your choice.
    </Typography>
  );
}

AwaitingHostVerifyNote.propTypes = { prizeDollars: PropTypes.number };

/** raffle_status → diagonal stamp: WINVERIFIED (host scanned), CLAIMED (PayPal / Venmo submitted), PAID (admin paid). */
const STATUS_STAMPS = {
  WINVERIFIED: { text: 'Win\nVerified', bg: '#ffe01b' },
  CLAIMED: { text: 'Claimed', bg: '#43c64a' },
  PAID: { text: 'Prize\nPaid', bg: '#1e88e5' }
};

function RaffleStatusStamp({ ticket, prizeDollars, children }) {
  const stamp = STATUS_STAMPS[ticket.status] || null;
  const paidTo = ticket.paypalInfo ? `PayPal ${ticket.paypalInfo}` : ticket.venmoInfo ? `Venmo ${ticket.venmoInfo}` : '';
  return (
    <Box sx={{ position: 'relative' }}>
      {children}
      {ticket.prizePaid && paidTo ? (
        <Typography
          sx={{
            '--mr-color': '#fff',
            mt: 1,
            mb: -0.5,
            textAlign: 'center',
            fontWeight: 900,
            fontSize: { xs: '1.05rem', sm: '1.15rem' },
            lineHeight: 1.25,
            wordBreak: 'break-word'
          }}
        >
          ${prizeDollars} paid to {paidTo}
        </Typography>
      ) : null}
      {stamp ? (
        <Box
          component="span"
          aria-label={stamp.text.replace('\n', ' ')}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-50deg)',
            whiteSpace: 'pre',
            textAlign: 'center',
            lineHeight: 0.95,
            fontWeight: 900,
            fontSize: { xs: '2.6rem', sm: '3rem' },
            color: stamp.bg,
            WebkitTextStroke: '2px #000',
            paintOrder: 'stroke fill',
            textShadow: '2px 2px 0 #000',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          {stamp.text}
        </Box>
      ) : null}
    </Box>
  );
}

RaffleStatusStamp.propTypes = {
  ticket: PropTypes.shape({
    status: PropTypes.string,
    prizePaid: PropTypes.bool,
    paypalInfo: PropTypes.string,
    venmoInfo: PropTypes.string
  }).isRequired,
  prizeDollars: PropTypes.number,
  children: PropTypes.node
};

/** Event name, date, location + claim / paid times under "Raffle Prize Claimed" / "Raffle Prize Paid". */
function PrizeStatusBox({ title, bg, color, event, ticket, showPaid }) {
  return (
    <Box
      sx={{
        '--mr-color': color,
        bgcolor: bg,
        border: '2px solid #111',
        borderRadius: 1,
        p: 1.25,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25
      }}
    >
      <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.25rem', sm: '1.4rem' } }}>{title}</Typography>
      <Typography sx={{ fontWeight: 700 }}>{event?.title || ticket.eventLabel}</Typography>
      <Typography sx={{ fontSize: '0.9rem' }}>{formatWhen(event?.nightDatetime, event?.timeZone)}</Typography>
      {event?.address || ticket.eventAddress ? (
        <Typography sx={{ fontSize: '0.9rem' }}>{event?.address || ticket.eventAddress}</Typography>
      ) : null}
      <Typography sx={{ fontSize: '0.9rem', mt: 0.5 }}>
        Raffle #{ticket.raffleNumber} claimed: {formatWhen(ticket.claimedAt, event?.timeZone)}
      </Typography>
      <Typography sx={{ fontSize: '0.9rem' }}>
        Pay to {ticket.paypalInfo ? `PayPal ${ticket.paypalInfo}` : `Venmo ${ticket.venmoInfo}`}
      </Typography>
      {showPaid ? <Typography sx={{ fontSize: '0.9rem' }}>Paid: {formatWhen(ticket.prizePaidAt, event?.timeZone)}</Typography> : null}
    </Box>
  );
}

function PayoutForm({ event, ticket, prizeDollars, onSubmitted }) {
  const [method, setMethod] = useState('paypal');
  const [paypal, setPaypal] = useState('');
  const [venmo, setVenmo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const info = (method === 'paypal' ? paypal : venmo).trim();
    if (info.length < 3) {
      setError(`Please enter your ${method === 'paypal' ? 'PayPal' : 'Venmo'} ID.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitRafflePayout(ticket.eventId, method, info);
      await onSubmitted();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your payout info. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const option = (value, label, hint, text, setText) => (
    <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="input"
          type="radio"
          name="raffle-payout"
          checked={method === value}
          onChange={() => setMethod(value)}
          sx={{ width: 18, height: 18, m: 0 }}
        />
        <Typography sx={{ fontWeight: 800 }}>{label}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, pl: 3.25 }}>
        <Typography sx={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{hint}</Typography>
        <Box
          component="input"
          type="text"
          value={text}
          onFocus={() => setMethod(value)}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          autoComplete="off"
          sx={{ ...fieldSx, width: '100%', boxSizing: 'border-box' }}
        />
      </Box>
    </Box>
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ border: '2px solid #111', borderRadius: 2, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography sx={{ fontWeight: 800, textAlign: 'center' }}>
        Congratulation, you won ${prizeDollars} cash for {event?.title || ticket.eventLabel}!
      </Typography>
      <Typography sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Please select how you like to receive the deposit:</Typography>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.35 }}>
        We will deposit the ${prizeDollars} within 48 hours and you will get an email confirming the deposit. Contact us at{' '}
        <Box component="a" href="mailto:raffle@tutamall.com" sx={{ color: '#0b3d91', fontWeight: 800 }}>
          raffle@tutamall.com
        </Box>{' '}
        for any questions.
      </Typography>
      {option('paypal', 'Deposit to PayPal', 'Your PayPal ID (email/phone):', paypal, setPaypal)}
      {option('venmo', 'Deposit to Venmo', 'Your Venmo ID (email/phone/@handle):', venmo, setVenmo)}
      {error ? <Typography sx={{ '--mr-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{error}</Typography> : null}
      <ColorTemplate13DisableGreenButton type="submit" hoverEnlargeFont disabled={busy} sx={pillSx}>
        {busy ? 'Saving…' : 'Submit'}
      </ColorTemplate13DisableGreenButton>
    </Box>
  );
}

/**
 * /mall raffle panel: Event drop-down + what to do for that event —
 *   won & no payout yet → PayPal / Venmo form (event locked until submitted)
 *   payout submitted → "Raffle Prize Claimed"; raffle_prize_paid → "Raffle Prize Paid"
 *   event night passed → "Selected Event Raffle Generation Closed"; otherwise Get My Raffle.
 */
export default function MallRafflePanel({ openRequest = 0 }) {
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [prizeDollars, setPrizeDollars] = useState(200);
  const [eventId, setEventId] = useState('');
  const [pastEventId, setPastEventId] = useState('');
  /** A Past Event is showing — reloads must not refill the (blank) Event field. */
  const pastPickedRef = useRef(false);
  const [referCode, setReferCode] = useState('');
  const [popupOpen, setPopupOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (openRequest > 0) {
      setExpanded(true);
      setPopupOpen(true);
    }
  }, [openRequest]);

  const pendingPayout = useMemo(() => tickets.find(isPrizePending) || null, [tickets]);
  const pendingPayoutKey = pendingPayout ? `${pendingPayout.eventId}:${pendingPayout.raffleNumber}` : '';

  /** Unclaimed prize: keep the winning ticket + Claim My Raffle Prize open and on screen. */
  useEffect(() => {
    if (!pendingPayoutKey) return;
    setExpanded(true);
    const id = window.requestAnimationFrame(() =>
      document.getElementById('mall-raffle-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
    return () => window.cancelAnimationFrame(id);
  }, [pendingPayoutKey]);

  const load = useCallback(async () => {
    try {
      const state = await fetchRaffleState();
      setEvents(state.events);
      setTickets(state.tickets);
      setPrizeDollars(state.prizeDollars);
      setReferCode(state.referCode);
      setLoadError('');
      const pending = state.tickets.find(isPrizePending);
      if (pending) {
        setEventId(String(pending.eventId));
        setPastEventId('');
        pastPickedRef.current = false;
        return;
      }
      if (pastPickedRef.current) return;
      setEventId((prev) => {
        const listable = state.events.filter((e) => e.showCombo && !e.nightPassed);
        if (prev && listable.some((e) => e.eventId === Number(prev))) return prev;
        const listed = state.tickets.filter((t) => listable.some((e) => e.eventId === t.eventId));
        return listed.length ? String(listed[listed.length - 1].eventId) : '';
      });
    } catch (err) {
      setLoadError(apiErrorMessage(err, ''));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedId = Number(eventId) || null;
  const event = events.find((e) => e.eventId === selectedId) || null;
  const ticket =
    tickets.find((t) => t.eventId === selectedId && t.status) || tickets.find((t) => t.eventId === selectedId && !t.bonus) || null;

  /** Event drop-down: upcoming (combo) events only — plus a won event still waiting for PayPal / Venmo info. */
  const comboEvents = useMemo(
    () => events.filter((e) => (e.showCombo && !e.nightPassed) || e.eventId === pendingPayout?.eventId).sort(byEventDateAsc),
    [events, pendingPayout]
  );
  /** Past Event drop-down: events already started where this member generated raffles. */
  const pastEvents = useMemo(
    () => events.filter((e) => e.nightPassed && tickets.some((t) => t.eventId === e.eventId)).sort(byEventDateAsc),
    [events, tickets]
  );
  const comboOptions = useMemo(() => comboEvents.map(eventOption), [comboEvents]);
  const pastOptions = useMemo(() => pastEvents.map(eventOption), [pastEvents]);
  /** Pixel width of the longest "date + event name" in the field font — the panel is sized to just fit it. */
  const panelRef = useRef(null);
  const [longestLabelPx, setLongestLabelPx] = useState(0);
  useLayoutEffect(() => {
    const labels = [...comboOptions, ...pastOptions].map((o) => o.label);
    const measure = () => {
      const ctx = document.createElement('canvas').getContext('2d');
      const el = panelRef.current?.querySelector('.MuiAutocomplete-input') || panelRef.current;
      if (!ctx || !el) return;
      const style = window.getComputedStyle(el);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setLongestLabelPx(Math.ceil(Math.max(0, ...labels.map((l) => ctx.measureText(l).width))));
    };
    measure();
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && measure());
    return () => {
      cancelled = true;
    };
  }, [comboOptions, pastOptions]);
  const pastSelectedId = Number(pastEventId) || null;
  const pastEvent = (pastSelectedId !== selectedId && pastEvents.find((e) => e.eventId === pastSelectedId)) || null;
  const pastTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.eventId === pastSelectedId)
        .sort((a, b) => Number(Boolean(b.won)) - Number(Boolean(a.won)) || Number(Boolean(a.bonus)) - Number(Boolean(b.bonus))),
    [tickets, pastSelectedId]
  );

  const pastBody = pastEvent ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ fontWeight: 800, textAlign: 'center' }}>
        Your {pastTickets.length === 1 ? 'raffle' : `${pastTickets.length} raffles`} for{' '}
        {formatEventDate(pastEvent.nightDatetime, pastEvent.timeZone)} {pastEvent.title || pastEvent.label}
      </Typography>
      <Box
        sx={{
          maxHeight: { xs: 380, sm: 440 },
          overflowY: pastTickets.length > 1 ? 'scroll' : 'visible',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          pr: pastTickets.length > 1 ? 0.75 : 0
        }}
      >
        {pastTickets.map((t) => (
          <Box key={t.verifyCode} sx={{ flexShrink: 0 }}>
            {t.status ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <WinningRaffleFrame raffleNumber={t.raffleNumber}>
                  <RaffleStatusStamp ticket={t} prizeDollars={prizeDollars}>
                    <RaffleTicketCard ticket={t} referCode={referCode} />
                  </RaffleStatusStamp>
                </WinningRaffleFrame>
                {isPrizePending(t) ? (
                  <ClaimPrizeSection event={pastEvent} ticket={t} prizeDollars={prizeDollars} onSubmitted={load} />
                ) : null}
              </Box>
            ) : t.won ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <RaffleTicketCard ticket={t} referCode={referCode} />
                <AwaitingHostVerifyNote prizeDollars={prizeDollars} />
              </Box>
            ) : (
              <RaffleTicketCard ticket={t} referCode={referCode} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  ) : null;

  let body;
  if (isPrizePending(ticket)) {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <WinningRaffleFrame raffleNumber={ticket.raffleNumber}>
          <RaffleTicketCard ticket={ticket} referCode={referCode} />
        </WinningRaffleFrame>
        <ClaimPrizeSection event={event} ticket={ticket} prizeDollars={prizeDollars} onSubmitted={load} />
      </Box>
    );
  } else if (ticket?.status === 'PAID') {
    body = <PrizeStatusBox title="Raffle Prize Paid" bg="#fff" color="#111" event={event} ticket={ticket} showPaid />;
  } else if (ticket?.status === 'CLAIMED') {
    body = <PrizeStatusBox title="Raffle Prize Claimed" bg="#1e88e5" color="#fff" event={event} ticket={ticket} />;
  } else if (event?.nightPassed) {
    body = (
      <Typography
        sx={{
          '--mr-color': '#fff',
          alignSelf: 'center',
          bgcolor: '#5f6b73',
          border: '2px solid #111',
          borderRadius: '999px',
          px: 2.5,
          py: 0.5,
          fontWeight: 800,
          textAlign: 'center'
        }}
      >
        Selected Event Raffle Generation Closed
      </Typography>
    );
  } else {
    body = (
      <Box
        component="button"
        type="button"
        disabled={!selectedId}
        title={selectedId ? undefined : 'Select your event first.'}
        aria-label="Get My Raffle Ticket"
        onClick={() => setPopupOpen(true)}
        sx={{
          alignSelf: 'center',
          p: 0,
          border: 0,
          bgcolor: 'transparent',
          lineHeight: 0,
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
          '&:not(:disabled):hover': { transform: 'scale(1.05)' },
          '&:disabled': { cursor: 'not-allowed', filter: 'grayscale(1)', opacity: 0.55 }
        }}
      >
        <Box component="img" src={getMyRaffleTicketImg} alt="" sx={{ height: { xs: 44, sm: 52 }, width: 'auto', display: 'block' }} />
      </Box>
    );
  }

  const panelWidth = `min(${Math.max(PANEL_MIN_PX, longestLabelPx + PANEL_CHROME_PX)}px, 96vw)`;

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-expanded={expanded}
        aria-controls="mall-raffle-panel"
        aria-label="Raffle"
        {...guestDemoAllowProps()}
        onClick={() => setExpanded((v) => (pendingPayout ? true : !v))}
        sx={{
          width: panelWidth,
          display: 'block',
          position: 'relative',
          containerType: 'inline-size',
          m: 0,
          mb: expanded ? 0.5 : 0,
          p: 0,
          bgcolor: 'transparent',
          border: 0,
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
        }}
      >
        <Box
          component="img"
          src={rafflesBannerImg}
          alt=""
          draggable={false}
          sx={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
        />
        {/* Covers the banner's black "Raffle" panel (x 531–810, tiles y 10–81 of the 1338×98 PNG). */}
        <Box
          component="span"
          sx={{
            position: 'absolute',
            left: '40%',
            width: '20.25%',
            top: '10.2%',
            height: '73.5%',
            bgcolor: PANEL_YELLOW,
            border: '1px solid #111',
            borderRadius: '3px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d50000',
            fontFamily: 'inherit',
            fontWeight: 900,
            fontSize: '3.4cqw',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          Toggle Me
        </Box>
      </Box>
      <Box
        id="mall-raffle-panel"
        ref={panelRef}
        sx={{
          width: panelWidth,
          bgcolor: PANEL_YELLOW,
          border: '3px solid #111',
          borderRadius: 2,
          p: { xs: 1, sm: 1.25 },
          display: expanded ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 1,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          boxSizing: 'border-box',
          position: 'relative',
          '&& .MuiTypography-root': { color: 'var(--mr-color, #111) !important' }
        }}
      >
        {pastEvent ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -0.5 }}>
            <ColorTemplate6CloseX
              aria-label="Close past event raffle"
              positionSx={{ position: 'static' }}
              onClose={() => {
                setPastEventId('');
                pastPickedRef.current = false;
              }}
            />
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="label" sx={{ fontWeight: 800, fontSize: { xs: '1rem', sm: '1.1rem' }, flexShrink: 0 }}>
            Event
          </Typography>
          <RaffleEventSelect
            options={comboOptions}
            value={eventId}
            disabled={Boolean(pendingPayout)}
            onChange={(next) => {
              setEventId(next);
              setPastEventId('');
              pastPickedRef.current = false;
              if (next && tickets.some((t) => t.eventId === Number(next) && !t.status)) setPopupOpen(true);
            }}
            placeholder="↓ Select your event"
            title={pendingPayout ? 'Please finish claiming your prize first.' : undefined}
          />
        </Box>
        {loadError ? <Typography sx={{ '--mr-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{loadError}</Typography> : null}
        {body}
        {pastEvents.length ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              component="label"
              sx={{ fontWeight: 800, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.05, textAlign: 'center', flexShrink: 0 }}
            >
              Past
              <br />
              Event
            </Typography>
            <RaffleEventSelect
              options={pastOptions}
              value={pastEventId}
              disabled={Boolean(pendingPayout)}
              onChange={(next) => {
                setPastEventId(next);
                pastPickedRef.current = Boolean(next);
                if (next) setEventId('');
              }}
              placeholder="↓ Past event you had raffles"
            />
          </Box>
        ) : null}
        {pastBody}
      </Box>
      <GetMyRafflePopup
        open={popupOpen}
        initialEventId={selectedId}
        onClose={() => {
          setPopupOpen(false);
          void load();
        }}
      />
    </>
  );
}

const eventShape = PropTypes.shape({
  title: PropTypes.string,
  nightDatetime: PropTypes.string,
  timeZone: PropTypes.string,
  address: PropTypes.string
});

const ticketShape = PropTypes.shape({
  eventId: PropTypes.number,
  eventLabel: PropTypes.string,
  eventAddress: PropTypes.string,
  raffleNumber: PropTypes.number,
  claimedAt: PropTypes.string,
  paypalInfo: PropTypes.string,
  venmoInfo: PropTypes.string,
  prizePaidAt: PropTypes.string
});

PrizeStatusBox.propTypes = {
  title: PropTypes.string.isRequired,
  bg: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  event: eventShape,
  ticket: ticketShape.isRequired,
  showPaid: PropTypes.bool
};

PayoutForm.propTypes = {
  event: eventShape,
  ticket: ticketShape.isRequired,
  prizeDollars: PropTypes.number.isRequired,
  onSubmitted: PropTypes.func.isRequired
};

ClaimPrizeSection.propTypes = {
  event: eventShape,
  ticket: ticketShape.isRequired,
  prizeDollars: PropTypes.number.isRequired,
  onSubmitted: PropTypes.func.isRequired
};

MallRafflePanel.propTypes = {
  openRequest: PropTypes.number
};
