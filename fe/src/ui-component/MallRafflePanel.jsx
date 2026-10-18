import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { raffleButtonColorSx } from 'config/raffleButtonColors';
import GetMyRafflePopup from 'ui-component/GetMyRafflePopup';
import { fetchRaffleState, submitRafflePayout } from 'api/raffleFe';

const PANEL_YELLOW = '#ffe01b';

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 3.25 }}>
        <Typography sx={{ fontSize: '0.85rem', flexShrink: 0 }}>{hint}</Typography>
        <Box
          component="input"
          type="text"
          value={text}
          onFocus={() => setMethod(value)}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          autoComplete="off"
          sx={{ ...fieldSx, flex: 1 }}
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
  const [popupOpen, setPopupOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (openRequest > 0) setPopupOpen(true);
  }, [openRequest]);

  const pendingPayout = useMemo(() => tickets.find((t) => t.claimed && !t.paypalInfo && !t.venmoInfo) || null, [tickets]);

  const load = useCallback(async () => {
    try {
      const state = await fetchRaffleState();
      setEvents(state.events);
      setTickets(state.tickets);
      setPrizeDollars(state.prizeDollars);
      setLoadError('');
      const pending = state.tickets.find((t) => t.claimed && !t.paypalInfo && !t.venmoInfo);
      if (pending) {
        setEventId(String(pending.eventId));
        return;
      }
      setEventId((prev) => {
        if (prev && state.events.some((e) => e.eventId === Number(prev))) return prev;
        const listed = state.tickets.filter((t) => state.events.some((e) => e.eventId === t.eventId));
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
  const ticket = tickets.find((t) => t.eventId === selectedId) || null;

  let body;
  if (ticket?.claimed && !ticket.paypalInfo && !ticket.venmoInfo) {
    body = <PayoutForm event={event} ticket={ticket} prizeDollars={prizeDollars} onSubmitted={load} />;
  } else if (ticket?.claimed && ticket.prizePaid) {
    body = <PrizeStatusBox title="Raffle Prize Paid" bg="#fff" color="#111" event={event} ticket={ticket} showPaid />;
  } else if (ticket?.claimed) {
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
      <ColorTemplate13DisableGreenButton type="button" hoverEnlargeFont onClick={() => setPopupOpen(true)} sx={pillSx}>
        Get My Raffle
      </ColorTemplate13DisableGreenButton>
    );
  }

  return (
    <>
      <Box
        sx={{
          width: 'min(440px, 92vw)',
          bgcolor: PANEL_YELLOW,
          border: '3px solid #111',
          borderRadius: 2,
          p: { xs: 1, sm: 1.25 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          boxSizing: 'border-box',
          '&& .MuiTypography-root': { color: 'var(--mr-color, #111) !important' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="label" sx={{ fontWeight: 800, fontSize: { xs: '1rem', sm: '1.1rem' }, flexShrink: 0 }}>
            Event
          </Typography>
          <Box
            component="select"
            value={eventId}
            disabled={Boolean(pendingPayout)}
            onChange={(e) => setEventId(e.target.value)}
            title={pendingPayout ? 'Please finish claiming your prize first.' : undefined}
            sx={{ ...fieldSx, flex: 1 }}
          >
            <option value="">↓ Select your event</option>
            {events.map((ev) => (
              <option key={ev.eventId} value={String(ev.eventId)}>
                {ev.title || ev.label}
              </option>
            ))}
          </Box>
        </Box>
        {loadError ? <Typography sx={{ '--mr-color': '#b00000', fontWeight: 700, textAlign: 'center' }}>{loadError}</Typography> : null}
        {body}
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

MallRafflePanel.propTypes = {
  openRequest: PropTypes.number
};
