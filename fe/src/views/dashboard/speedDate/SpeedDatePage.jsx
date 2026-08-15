import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MainCard from 'ui-component/cards/MainCard';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import { formatAliasWithMemberCode } from 'utils/memberLabel';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { themedAlert } from 'utils/themedDialog';
import SpeedDateCallPanel from './SpeedDateCallPanel';
import {
  createSpeedDateEvent,
  endSpeedDateEvent,
  fetchSpeedDateSession,
  heartbeatSpeedDate,
  listSpeedDateEvents,
  nextSpeedDateRound,
  postSpeedDateInterest,
  rsvpSpeedDateEvent,
  startSpeedDateEvent
} from 'api/speedDateFe';

const API_BASE_URL = getApiBaseUrl();

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function partnerPhotoUrl(fk) {
  const id = Number(fk);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${API_BASE_URL}/api/photo/${id}`;
}

export default function SpeedDatePage() {
  const { user } = useAuth();
  const isAdmin = isAdminSession(user);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('Friday Speed Dating');
  const [roundMinutes, setRoundMinutes] = useState(20);
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [maxRounds, setMaxRounds] = useState(6);
  const [mixMode, setMixMode] = useState('gender');
  const [zoomLobbyUrl, setZoomLobbyUrl] = useState('');

  const event = session?.event || null;
  const eventId = event?.event_id || selectedEventId;
  const roundLive = session?.round?.status === 'live';
  const pairId = session?.pair?.pair_id || null;

  const loadEvents = useCallback(async () => {
    const data = await listSpeedDateEvents();
    setEvents(Array.isArray(data?.events) ? data.events : []);
  }, []);

  const loadSession = useCallback(async (id) => {
    const data = await fetchSpeedDateSession(id);
    setSession(data);
    if (data?.event?.event_id) setSelectedEventId(data.event.event_id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError('');
      await loadEvents();
      await loadSession(selectedEventId);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load speed dating.');
    } finally {
      setLoading(false);
    }
  }, [loadEvents, loadSession, selectedEventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadEvents().catch(() => {});
      loadSession(selectedEventId).catch(() => {});
    }, pairId && roundLive ? 1500 : 3000);
    return () => window.clearInterval(timer);
  }, [loadEvents, loadSession, selectedEventId, pairId, roundLive]);

  useEffect(() => {
    if (!eventId || session?.my_rsvp?.status !== 'joined') return undefined;
    const tick = () => {
      heartbeatSpeedDate(eventId, true).catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 10000);
    return () => window.clearInterval(timer);
  }, [eventId, session?.my_rsvp?.status]);

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) await themedAlert(successMsg);
      await refresh();
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const partnerLabel = useMemo(
    () =>
      session?.pair?.partner
        ? formatAliasWithMemberCode({
            alias: session.pair.partner.alias,
            prefix: session.pair.partner.prefix,
            memberId: session.pair.partner.member_id,
            singlesId: session.pair.partner.singles_id
          })
        : 'Partner',
    [session?.pair?.partner]
  );

  const remainingMs = session?.round?.remaining_ms ?? 0;

  return (
    <MainCard title="Speed Dating">
      <Stack spacing={2}>
        <Typography sx={{ fontSize: { xs: '4vw', sm: getDesktopTitleFontSizeVw() }, fontWeight: 700 }}>
          20-minute 1:1 video dates
        </Typography>
        <Typography>
          Up to 50 guests (25 live SD video pairs). Video goes directly between your browsers — our web servers only
          match you and keep the clock. Optional Zoom lobby link is for check-in only, not the 25 pair rooms.
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : null}

        {isAdmin ? (
          <Box sx={{ p: 2, border: '1px solid var(--theme-primary-color)', borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Host: create an event</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
              <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TextField
                size="small"
                type="number"
                label="Minutes / round"
                value={roundMinutes}
                onChange={(e) => setRoundMinutes(e.target.value)}
                sx={{ width: 140 }}
              />
              <TextField
                size="small"
                type="number"
                label="Max people"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Rounds"
                value={maxRounds}
                onChange={(e) => setMaxRounds(e.target.value)}
                sx={{ width: 110 }}
              />
              <UnSelectedButtonTemplate onClick={() => setMixMode('gender')}>
                {mixMode === 'gender' ? 'Pairing: M/F rotate' : 'Use M/F rotate'}
              </UnSelectedButtonTemplate>
              <UnSelectedButtonTemplate onClick={() => setMixMode('random')}>
                {mixMode === 'random' ? 'Pairing: random' : 'Use random'}
              </UnSelectedButtonTemplate>
              <TextField
                size="small"
                label="Optional Zoom lobby URL"
                value={zoomLobbyUrl}
                onChange={(e) => setZoomLobbyUrl(e.target.value)}
                sx={{ minWidth: 280, flex: 1 }}
              />
              <UnSelectedButtonTemplate
                disabled={busy}
                onClick={() =>
                  run(() =>
                    createSpeedDateEvent({
                      title,
                      round_minutes: Number(roundMinutes),
                      max_participants: Number(maxParticipants),
                      max_rounds: Number(maxRounds),
                      mix_mode: mixMode,
                      zoom_lobby_url: zoomLobbyUrl
                    })
                  )
                }
              >
                Create & open RSVP
              </UnSelectedButtonTemplate>
            </Stack>
          </Box>
        ) : null}

        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Events</Typography>
          <Stack spacing={1}>
            {events.length === 0 ? <Typography>No speed dating events yet.</Typography> : null}
            {events.map((row) => {
              const selected = Number(row.event_id) === Number(eventId);
              const joined = Number(session?.event?.event_id) === Number(row.event_id) && session?.my_rsvp?.status === 'joined';
              return (
                <Box
                  key={row.event_id}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: selected ? '2px solid var(--theme-primary-color)' : '1px solid rgba(0,0,0,0.2)'
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {row.title} · {row.status} · {row.rsvp_count ?? 0}/{row.max_participants} RSVPs · {row.round_minutes} min rounds
                      </Typography>
                      {row.starts_at ? (
                        <Typography variant="body2">Starts {new Date(row.starts_at).toLocaleString()}</Typography>
                      ) : null}
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <UnSelectedButtonTemplate
                        disabled={busy}
                        onClick={() => {
                          setSelectedEventId(row.event_id);
                          loadSession(row.event_id).catch((err) => {
                            setError(err?.response?.data?.error || err?.message || 'Could not load event');
                          });
                        }}
                      >
                        View
                      </UnSelectedButtonTemplate>
                      {joined ? (
                        <UnSelectedButtonTemplate disabled={busy} onClick={() => run(() => rsvpSpeedDateEvent(row.event_id, true))}>
                          Leave
                        </UnSelectedButtonTemplate>
                      ) : (
                        <SelectedButtonTemplate disabled={busy} onClick={() => run(() => rsvpSpeedDateEvent(row.event_id, false))}>
                          RSVP
                        </SelectedButtonTemplate>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {event ? (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--theme-daynight-color)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>
                {event.title}
                {session?.round
                  ? ` · Round ${session.round.round_no}/${event.max_rounds} · ${session.round.status} · ${formatCountdown(remainingMs)}`
                  : ' · Lobby'}
              </Typography>
              {isAdmin ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {event.status === 'open' || (event.status === 'live' && Number(event.current_round_no) === 0) ? (
                    <SelectedButtonTemplate disabled={busy} onClick={() => run(() => startSpeedDateEvent(event.event_id))}>
                      Start round 1
                    </SelectedButtonTemplate>
                  ) : null}
                  {event.status === 'live' ? (
                    <UnSelectedButtonTemplate disabled={busy} onClick={() => run(() => nextSpeedDateRound(event.event_id))}>
                      Next round now
                    </UnSelectedButtonTemplate>
                  ) : null}
                  {event.status !== 'ended' && event.status !== 'canceled' ? (
                    <UnSelectedButtonTemplate disabled={busy} onClick={() => run(() => endSpeedDateEvent(event.event_id))}>
                      End event
                    </UnSelectedButtonTemplate>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>

            {event.zoom_lobby_url ? (
              <Typography sx={{ mt: 1 }}>
                Zoom check-in (optional):{' '}
                <Box component="a" href={event.zoom_lobby_url} target="_blank" rel="noreferrer">
                  {event.zoom_lobby_url}
                </Box>
              </Typography>
            ) : null}

            {session?.sitting_out && roundLive ? (
              <Alert sx={{ mt: 2 }} severity="info">
                This round you sit out (odd number of guests). Stay on this page — the next round starts automatically.
              </Alert>
            ) : null}

            {pairId && roundLive ? (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  {partnerPhotoUrl(session.pair.partner?.profile_image_fk) ? (
                    <Box
                      component="img"
                      src={partnerPhotoUrl(session.pair.partner.profile_image_fk)}
                      alt=""
                      sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover' }}
                    />
                  ) : null}
                  <Typography sx={{ fontWeight: 700 }}>Chatting with {partnerLabel}</Typography>
                </Stack>
                <SpeedDateCallPanel
                  pairId={pairId}
                  isOfferer={session.pair.is_offerer === true}
                  iceServers={session.ice_servers}
                  partnerLabel={partnerLabel}
                />
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {session.pair.my_want_meet === true ? (
                    <Typography>You asked to meet again.</Typography>
                  ) : (
                    <SelectedButtonTemplate
                      disabled={busy}
                      onClick={() => run(() => postSpeedDateInterest(pairId, true), 'Saved. If they tap it too, you both want a follow-up.')}
                    >
                      I want to meet again
                    </SelectedButtonTemplate>
                  )}
                  {session.pair.mutual_want_meet ? (
                    <Typography sx={{ fontWeight: 700 }}>Mutual yes — you both want a follow-up.</Typography>
                  ) : null}
                </Stack>
              </Box>
            ) : session?.my_rsvp?.status === 'joined' ? (
              <Alert sx={{ mt: 2 }} severity="success">
                You are RSVPed. Allow camera/mic when the host starts the round. Keep this tab open.
              </Alert>
            ) : (
              <Alert sx={{ mt: 2 }} severity="info">
                RSVP to join the next round.
              </Alert>
            )}

            {isAdmin && Array.isArray(session?.guests) ? (
              <Typography sx={{ mt: 2 }} variant="body2">
                Guests: {session.guests.length} · camera-ready {event.ready_count ?? 0}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Stack>
    </MainCard>
  );
}
