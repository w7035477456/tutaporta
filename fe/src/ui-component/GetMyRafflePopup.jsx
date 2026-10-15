import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { createRaffleTicket, fetchRaffleState } from 'api/raffleFe';

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

/**
 * Get My Raffle — event drop-down (opens the Meetup page in a new window), Generate Raffle Number
 * (one per account per event, issued + stored server-side), then number + verification code + QR.
 */
export default function GetMyRafflePopup({ open, onClose }) {
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [eventKey, setEventKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchRaffleState()
      .then((state) => {
        if (cancelled) return;
        setEvents(state.events);
        setTickets(state.tickets);
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

  const ticket = useMemo(() => tickets.find((t) => t.eventKey === eventKey) || null, [tickets, eventKey]);

  const handleEventChange = (event) => {
    const key = event.target.value;
    setEventKey(key);
    setError('');
    const url = events.find((e) => e.key === key)?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGenerate = async () => {
    if (!eventKey || generating) return;
    setGenerating(true);
    setError('');
    try {
      const { ticket: issued } = await createRaffleTicket(eventKey);
      if (issued) setTickets((prev) => [...prev.filter((t) => t.eventKey !== issued.eventKey), issued]);
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
            value={eventKey}
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
              <option key={event.key} value={event.key}>
                {event.label}
              </option>
            ))}
          </TextField>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : null}

          {!loading && eventKey && !ticket ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <ColorTemplate13DisableGreenButton
                type="button"
                hoverEnlargeFont
                disabled={generating}
                onClick={() => void handleGenerate()}
                sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.2rem' }, px: 2.5 }}
              >
                {generating ? 'Generating…' : 'Generate Raffle Number'}
              </ColorTemplate13DisableGreenButton>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Only 1 raffle per email account</Typography>
            </Box>
          ) : null}

          {!loading && !eventKey ? (
            <Typography sx={{ textAlign: 'center', fontWeight: 700 }}>Choose your Meetup event above.</Typography>
          ) : null}

          {error ? (
            <Typography sx={{ textAlign: 'center', fontWeight: 700, color: 'var(--theme-error-color)' }}>{error}</Typography>
          ) : null}

          {ticket ? (
            <>
              <RaffleTicketCard ticket={ticket} />
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
