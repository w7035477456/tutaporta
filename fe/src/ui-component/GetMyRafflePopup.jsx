import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { raffleButtonColorSx } from 'config/raffleButtonColors';
import { createRaffleBonusTickets, createRaffleTicket, fetchRaffleState, selectRaffleEvent } from 'api/raffleFe';

function apiErrorMessage(err, fallback) {
  return String(err?.response?.data?.error || '').trim() || fallback;
}

export function RaffleTicketCard({ ticket, referCode }) {
  const verifyUrl = `${window.location.origin}${ticket.verifyPath}`;
  const issuedAt = ticket.createdAt ? new Date(ticket.createdAt) : null;
  return (
    <Box
      sx={{
        border: '3px solid var(--theme-primary-color)',
        borderRadius: 2,
        bgcolor: '#fff',
        color: '#000',
        p: { xs: 1.5, sm: 2 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.5, sm: 3 }
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>Your raffle number</Typography>
        <Typography
          sx={{ fontWeight: 900, color: 'var(--theme-primary-color)', lineHeight: 1.1, fontSize: { xs: '3.5rem', sm: '4.5rem' } }}
        >
          {ticket.raffleNumber}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Verification code</Typography>
        <Typography sx={{ fontWeight: 900, fontFamily: 'monospace', fontSize: { xs: '1.4rem', sm: '1.6rem' }, letterSpacing: 2 }}>
          {ticket.verifyCode}
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', mt: 0.5 }}>{ticket.eventLabel}</Typography>
        {ticket.eventAddress ? (
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#333' }}>{ticket.eventAddress}</Typography>
        ) : null}
        {issuedAt ? <Typography sx={{ fontSize: '0.85rem', color: '#333' }}>{issuedAt.toLocaleString()}</Typography> : null}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ bgcolor: '#fff', p: 1, lineHeight: 0 }}>
          <QRCodeSVG value={verifyUrl} size={150} level="M" includeMargin={false} aria-label="Raffle verification QR code" />
        </Box>
        {referCode ? (
          <Typography sx={{ color: RAFFLE_ALREADY_RED, fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.25, textAlign: 'center' }}>
            Friend
            <br />
            Refer Code
            <br />
            {referCode}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

RaffleTicketCard.propTypes = {
  referCode: PropTypes.string,
  ticket: PropTypes.shape({
    eventLabel: PropTypes.string,
    eventAddress: PropTypes.string,
    raffleNumber: PropTypes.number,
    verifyCode: PropTypes.string,
    verifyPath: PropTypes.string,
    createdAt: PropTypes.string
  }).isRequired
};

function formatWindowTime(value, timeZone, withZone = false) {
  if (!value) return '';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  try {
    const text = new Date(value).toLocaleString(undefined, { ...opts, timeZone });
    if (!withZone) return text;
    const zone = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date(value))
      .find((p) => p.type === 'timeZoneName')?.value;
    return zone ? `${text} ${zone}` : text;
  } catch {
    return new Date(value).toLocaleString(undefined, opts);
  }
}

const RAFFLE_ALREADY_RED = '#e60000';

const raffleNoticeBoxSx = {
  textAlign: 'center',
  fontWeight: 800,
  color: '#111',
  px: 1.5,
  py: 1,
  borderRadius: 1
};

const bonusBoxSx = {
  bgcolor: '#ffe01b',
  color: '#111',
  border: '3px solid #000',
  borderRadius: 3,
  p: { xs: 1.5, sm: 2 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1
};

const bonusTextSx = { fontFamily: 'serif', fontSize: { xs: '1.05rem', sm: '1.15rem' }, lineHeight: 1.3, color: '#111' };

const DEFAULT_ALREADY_GENERATED_MESSAGE = 'You already generate a raffle for this event. Only 1 raffle per email login.';

/**
 * Get My Raffle — drop-down of raffle_event rows with event_show_combo = true (opens the Meetup page
 * in a new window and links member ↔ host ↔ event), Generate My Raffle (one per login per event,
 * only inside the host's raffle window), then number + verification code + QR.
 */
export default function GetMyRafflePopup({ open, onClose, initialEventId = null }) {
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [referCode, setReferCode] = useState('');
  const [refer, setRefer] = useState({ credit: 0, remaining: 0, friends: 0, per: 2 });
  const [bonusCount, setBonusCount] = useState('');
  const [bonusGenerating, setBonusGenerating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [prizeDollars, setPrizeDollars] = useState(200);
  const [alreadyMessage, setAlreadyMessage] = useState(DEFAULT_ALREADY_GENERATED_MESSAGE);
  const [freshEventIds, setFreshEventIds] = useState([]);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setFreshEventIds([]);
    fetchRaffleState()
      .then((state) => {
        if (cancelled) return;
        const comboEvents = state.events.filter((e) => e.showCombo !== false && !e.nightPassed);
        setEvents(comboEvents);
        setTickets(state.tickets);
        setReferCode(state.referCode);
        setPrizeDollars(state.prizeDollars);
        setRefer({ credit: state.referCredit, remaining: state.referRemaining, friends: state.referFriends, per: state.rafflePerRefer });
        setBonusCount(state.referRemaining > 0 ? String(state.referRemaining) : '');
        if (initialEventId && comboEvents.some((e) => e.eventId === Number(initialEventId))) {
          setEventId(String(initialEventId));
          return;
        }
        const listed = state.tickets.filter((t) => comboEvents.some((e) => e.eventId === t.eventId));
        const latest = listed[listed.length - 1];
        if (latest) setEventId((prev) => prev || String(latest.eventId));
        if (state.alreadyGeneratedMessage) setAlreadyMessage(state.alreadyGeneratedMessage);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load raffles. Please try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialEventId]);

  const selectedId = Number(eventId) || null;
  const selectedEvent = useMemo(() => events.find((e) => e.eventId === selectedId) || null, [events, selectedId]);
  const ticket = useMemo(() => tickets.find((t) => t.eventId === selectedId && !t.bonus) || null, [tickets, selectedId]);
  const eventTickets = useMemo(
    () => tickets.filter((t) => t.eventId === selectedId).sort((a, b) => Number(Boolean(a.bonus)) - Number(Boolean(b.bonus))),
    [tickets, selectedId]
  );
  const ticketIsFresh = ticket ? freshEventIds.includes(ticket.eventId) : false;
  /** Opened from the mall panel with its event already picked — no second event choice / Generate click. */
  const eventPreselected =
    Boolean(initialEventId) && Number(eventId) === Number(initialEventId) && events.some((e) => e.eventId === Number(initialEventId));
  const autoGeneratedRef = useRef(false);

  useEffect(() => {
    if (!open) autoGeneratedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [open]);

  const bonusMax = refer.remaining;
  const eventStarted = Boolean(selectedEvent?.nightDatetime) && now >= new Date(selectedEvent.nightDatetime).getTime();
  const bonusCountNum = Number(bonusCount);
  const bonusCountValid = Number.isInteger(bonusCountNum) && bonusCountNum >= 1 && bonusCountNum <= bonusMax;

  const handleGenerateBonus = async () => {
    if (!selectedId || bonusGenerating || !bonusCountValid || eventStarted) return;
    setBonusGenerating(true);
    setError('');
    try {
      const { tickets: issued, referCredit, referRemaining } = await createRaffleBonusTickets(selectedId, bonusCountNum);
      setTickets((prev) => [...prev, ...issued]);
      setRefer((prev) => ({ ...prev, credit: referCredit, remaining: referRemaining }));
      setBonusCount(referRemaining > 0 ? String(referRemaining) : '');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your bonus raffles. Please try again.'));
    } finally {
      setBonusGenerating(false);
    }
  };

  const handleEventChange = (event) => {
    const nextId = event.target.value;
    setEventId(nextId);
    setError('');
    const picked = events.find((e) => e.eventId === Number(nextId));
    if (picked?.url) window.open(picked.url, '_blank', 'noopener,noreferrer');
    if (picked) void selectRaffleEvent(picked.eventId).catch(() => {});
  };

  const handleGenerate = async () => {
    if (!selectedId || generating) return;
    setGenerating(true);
    setError('');
    try {
      const { ticket: issued, alreadyHad, message } = await createRaffleTicket(selectedId);
      if (issued) {
        setTickets((prev) => [...prev.filter((t) => t.eventId !== issued.eventId || t.bonus), issued]);
        if (!alreadyHad) setFreshEventIds((prev) => [...prev, issued.eventId]);
        if (alreadyHad && message) setAlreadyMessage(message);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your raffle. Please try again.'));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!open || loading || !eventPreselected || ticket || generating || autoGeneratedRef.current) return;
    autoGeneratedRef.current = true;
    void selectRaffleEvent(Number(initialEventId)).catch(() => {});
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, eventPreselected, ticket, generating, initialEventId]);

  const raffleOpenLine = selectedEvent ? (
    <Typography sx={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
      Raffle open {formatWindowTime(selectedEvent.raffleStart, selectedEvent.timeZone)} –{' '}
      {formatWindowTime(selectedEvent.raffleEnd, selectedEvent.timeZone, true)}
    </Typography>
  ) : null;

  return (
    <ColorTemplate16PopupCenterWide open={open} onClose={onClose} maxWidth={eventTickets.length ? 'min(1240px, 98vw)' : 'min(620px, 94vw)'}>
      <ColorTemplate16PopupCenterWide.Title>{ticket ? 'Your Raffle' : 'Get My Raffle'}</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'stretch', gap: 2 }}>
          <Box sx={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }}>
            {ticket && !ticketIsFresh && bonusMax <= 0 && eventTickets.length === 1 ? (
              <Typography sx={{ ...raffleNoticeBoxSx, bgcolor: RAFFLE_ALREADY_RED }}>{alreadyMessage}</Typography>
            ) : null}
            {eventPreselected ? (
              <Typography sx={{ textAlign: 'center', fontWeight: 800 }}>{selectedEvent?.label}</Typography>
            ) : (
              <TextField
                select
                fullWidth
                size="small"
                label="Event"
                value={eventId}
                onChange={handleEventChange}
                disabled={loading}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: '#fff', borderRadius: 1 }}
              >
                <option value="" disabled>
                  Select an event
                </option>
                {events.map((event) => (
                  <option key={event.eventId} value={String(event.eventId)}>
                    {event.label}
                  </option>
                ))}
              </TextField>
            )}

            {!loading && selectedId && (bonusMax > 0 || eventTickets.length > 1) ? (
              <Box sx={bonusBoxSx}>
                <Typography sx={{ fontFamily: 'serif', fontWeight: 800, fontSize: { xs: '1.25rem', sm: '1.4rem' }, lineHeight: 1.25 }}>
                  Congratulations! {refer.friends} {refer.friends === 1 ? 'friend' : 'friends'} you referred{' '}
                  {refer.friends === 1 ? 'has' : 'have'} registered.
                </Typography>
                <Typography sx={bonusTextSx}>
                  <b>Tickets earned:</b> {1 + refer.friends * refer.per} (1 for you + {refer.per} per referred friend)
                </Typography>
                <Typography sx={bonusTextSx}>
                  <b>Already generated:</b> {eventTickets.length}
                </Typography>
                <Typography sx={bonusTextSx}>
                  <b>Remaining (any event):</b> {bonusMax}
                </Typography>
                <Typography
                  component="div"
                  aria-disabled={bonusMax <= 0}
                  sx={{
                    ...bonusTextSx,
                    border: '1px solid #000',
                    px: 1,
                    py: 0.5,
                    ...(bonusMax <= 0 ? { bgcolor: '#a9b4ba', color: '#555', borderColor: '#666' } : null)
                  }}
                >
                  <label htmlFor="raffle-bonus-count">How many would you like to generate now?</label>{' '}
                  <Box
                    component="input"
                    id="raffle-bonus-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={bonusMax}
                    value={bonusCount}
                    disabled={eventStarted || bonusGenerating || bonusMax <= 0}
                    onChange={(e) => setBonusCount(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    sx={{
                      width: 48,
                      fontSize: '1rem',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      border: '1px solid #333',
                      borderRadius: 0.5,
                      bgcolor: '#fff',
                      color: '#000',
                      '&:disabled': { bgcolor: '#d0d5d8', borderColor: '#777', color: '#555' }
                    }}
                  />{' '}
                  (up to {bonusMax})
                </Typography>
                <Box>
                  <ColorTemplate13DisableGreenButton
                    type="button"
                    hoverEnlargeFont
                    disabled={eventStarted || bonusGenerating || bonusMax <= 0 || !bonusCountValid}
                    onClick={() => void handleGenerateBonus()}
                    sx={{ fontWeight: 700, fontSize: '1rem', px: 2, ...raffleButtonColorSx }}
                  >
                    {bonusGenerating ? 'Generating…' : 'Generate Raffles Tickets'}
                  </ColorTemplate13DisableGreenButton>
                </Box>
                {eventStarted ? (
                  <Typography sx={{ ...bonusTextSx, fontWeight: 800, color: RAFFLE_ALREADY_RED }}>
                    The event has started — bonus tickets can no longer be generated.
                  </Typography>
                ) : null}
                <Typography sx={bonusTextSx}>
                  Already generated some? They&apos;re shown on the right. Scroll through and screenshot each one so you can match and claim
                  them at the event.
                </Typography>
              </Box>
            ) : null}

            {selectedEvent && selectedEvent.raffleStart && selectedEvent.raffleEnd && !eventTickets.length ? raffleOpenLine : null}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : null}

            {!loading && selectedId && !ticket && eventPreselected && (generating || !error) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : null}

            {!loading && selectedId && !ticket && (!eventPreselected || (error && !generating)) ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <ColorTemplate13DisableGreenButton
                  type="button"
                  hoverEnlargeFont
                  disabled={generating}
                  onClick={() => void handleGenerate()}
                  sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.2rem' }, px: 2.5, ...raffleButtonColorSx }}
                >
                  {generating ? 'Generating…' : 'Generate My Raffle'}
                </ColorTemplate13DisableGreenButton>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Only 1 raffle per email login</Typography>
              </Box>
            ) : null}

            {!loading && !selectedId ? (
              <Typography sx={{ textAlign: 'center', fontWeight: 700 }}>Choose your Meetup event above.</Typography>
            ) : null}

            {error ? (
              <Typography sx={{ textAlign: 'center', fontWeight: 700, color: 'var(--theme-error-color)' }}>{error}</Typography>
            ) : null}

            {eventTickets.length ? (
              <>
                <Box sx={{ fontFamily: 'serif', color: '#111' }}>
                  <Typography sx={{ fontFamily: 'serif', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.3 }}>
                    Don&apos;t forget to screenshot each of your raffle tickets and bring them to the event. Physical present at event
                    required.
                  </Typography>
                  <Typography sx={{ fontFamily: 'serif', fontSize: '1rem', lineHeight: 1.35, mt: 0.75 }}>
                    When the host calls out a winning number, check your tickets. If it matches one of yours, shout &ldquo;I win!&rdquo; and
                    show your screenshot to the host to be scanned. Then come back to this site to claim your ${prizeDollars} prize, which
                    will be sent to your Venmo or PayPal.
                  </Typography>
                </Box>
                {selectedEvent && selectedEvent.raffleStart && selectedEvent.raffleEnd ? raffleOpenLine : null}
              </>
            ) : null}
          </Box>

          {eventTickets.length ? (
            <Box sx={{ flex: { xs: '0 0 auto', sm: '1 1 0%' }, minWidth: 0, position: 'relative', minHeight: { sm: 460 } }}>
              <Box
                sx={{
                  position: { xs: 'static', sm: 'absolute' },
                  inset: 0,
                  maxHeight: { xs: 460, sm: 'none' },
                  overflowX: 'hidden',
                  overflowY: 'scroll',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  border: '2px solid #000',
                  p: 1
                }}
              >
                {eventTickets.map((t) => (
                  <Box key={t.verifyCode} sx={{ flexShrink: 0 }}>
                    <RaffleTicketCard ticket={t} referCode={referCode} />
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

GetMyRafflePopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  initialEventId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};
