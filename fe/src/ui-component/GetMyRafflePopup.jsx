import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { createRaffleTicket, fetchRaffleState, selectRaffleEvent } from 'api/raffleFe';

function apiErrorMessage(err, fallback) {
  return String(err?.response?.data?.error || '').trim() || fallback;
}

function RaffleTicketCard({ ticket }) {
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
        {issuedAt ? <Typography sx={{ fontSize: '0.85rem', color: '#333' }}>{issuedAt.toLocaleString()}</Typography> : null}
      </Box>
      <Box sx={{ bgcolor: '#fff', p: 1, lineHeight: 0 }}>
        <QRCodeSVG value={verifyUrl} size={150} level="M" includeMargin={false} aria-label="Raffle verification QR code" />
      </Box>
    </Box>
  );
}

RaffleTicketCard.propTypes = {
  ticket: PropTypes.shape({
    eventLabel: PropTypes.string,
    raffleNumber: PropTypes.number,
    verifyCode: PropTypes.string,
    verifyPath: PropTypes.string,
    createdAt: PropTypes.string
  }).isRequired
};

function formatWindowTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const DEFAULT_ALREADY_GENERATED_MESSAGE =
  'You already generate a raffle for this event. Only 1 raffle per email login.';

/**
 * Get My Raffle — drop-down of raffle_event rows with event_show_combo = true (opens the Meetup page
 * in a new window and links member ↔ host ↔ event), Generate My Raffle (one per login per event,
 * only inside the host's raffle window), then number + verification code + QR.
 */
export default function GetMyRafflePopup({ open, onClose }) {
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
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
        setEvents(state.events);
        setTickets(state.tickets);
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
  }, [open]);

  const selectedId = Number(eventId) || null;
  const selectedEvent = useMemo(() => events.find((e) => e.eventId === selectedId) || null, [events, selectedId]);
  const ticket = useMemo(() => tickets.find((t) => t.eventId === selectedId) || null, [tickets, selectedId]);
  const ticketIsFresh = ticket ? freshEventIds.includes(ticket.eventId) : false;

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
        setTickets((prev) => [...prev.filter((t) => t.eventId !== issued.eventId), issued]);
        if (!alreadyHad) setFreshEventIds((prev) => [...prev, issued.eventId]);
        if (alreadyHad && message) setAlreadyMessage(message);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your raffle. Please try again.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ColorTemplate16PopupCenterWide open={open} onClose={onClose} maxWidth="min(620px, 94vw)">
      <ColorTemplate16PopupCenterWide.Title>Get My Raffle</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }}>
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

          {selectedEvent && selectedEvent.raffleStart && selectedEvent.raffleEnd ? (
            <Typography sx={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
              Raffle open {formatWindowTime(selectedEvent.raffleStart)} – {formatWindowTime(selectedEvent.raffleEnd)}
            </Typography>
          ) : null}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : null}

          {!loading && selectedId && !ticket ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <ColorTemplate13DisableGreenButton
                type="button"
                hoverEnlargeFont
                disabled={generating}
                onClick={() => void handleGenerate()}
                sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.2rem' }, px: 2.5 }}
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

          {ticket ? (
            <>
              <RaffleTicketCard ticket={ticket} />
              {!ticketIsFresh ? (
                <Typography sx={{ textAlign: 'center', fontWeight: 700, color: 'var(--theme-error-color)' }}>
                  {alreadyMessage}
                </Typography>
              ) : null}
              <Typography sx={{ textAlign: 'center', fontWeight: 700 }}>
                Take a screenshot of this screen and bring it to the Meetup event.
              </Typography>
            </>
          ) : null}
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

GetMyRafflePopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func
};
