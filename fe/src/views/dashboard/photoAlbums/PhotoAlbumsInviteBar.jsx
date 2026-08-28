import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import {
  sendPhotoAlbumsInvite,
  readPhotoAlbumsInviteError
} from 'api/photoAlbumsInviteFe';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import { openPhotoAlbumsContextTutorialPopout } from './photoAlbumsContextTutorialSync';

function isValidEmailFormat(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const inviteFieldSx = {
  flex: { xs: '1 1 100%', md: '0 0 30rem' },
  width: { xs: '100%', md: '30rem' },
  maxWidth: { xs: '100%', md: '30rem' },
  minWidth: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#fff',
    borderRadius: 1,
    border: '2px solid #000',
    fontSize: { xs: '0.9rem', sm: '1rem' }
  },
  '& .MuiInputBase-input': {
    color: '#000',
    WebkitTextFillColor: '#000',
    py: { xs: 0.85, sm: 1 }
  },
  '& .MuiInputBase-root.Mui-error': {
    borderColor: '#b71c1c'
  }
};

const inviteActionSx = {
  flex: '0 0 auto',
  width: 'auto',
  minWidth: 0,
  px: { xs: 0.75, sm: 1 },
  py: { xs: 0.35, sm: 0.45 },
  whiteSpace: 'nowrap'
};

export default function PhotoAlbumsInviteBar({
  disabled = false,
  noteId,
  notebookId,
  storageType,
  albumSetName,
  albumName,
  onInvited,
  onOpenReview
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const canInvite = Boolean(noteId && notebookId && storageType && !disabled);
  const trimmedEmail = String(email || '').trim();
  const emailFormatValid = useMemo(() => isValidEmailFormat(trimmedEmail), [trimmedEmail]);
  const showEmailFormatError = emailTouched && trimmedEmail.length > 0 && !emailFormatValid;

  const openReview = (sendResult) => {
    onOpenReview?.(sendResult || null);
  };

  const handleInvite = async () => {
    setEmailTouched(true);
    const trimmed = String(email || '').trim();
    if (!trimmed) {
      const message = 'Enter an email address to invite.';
      setError(message);
      openReview({ ok: false, email: '', message });
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      const message = 'Enter a valid email address (example@domain.com).';
      setError(message);
      openReview({ ok: false, email: trimmed, message });
      return;
    }
    if (!canInvite) {
      const message = 'Open an album before sending an invite.';
      setError(message);
      openReview({ ok: false, email: trimmed, message });
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendPhotoAlbumsInvite({
        email: trimmed,
        noteId,
        notebookId,
        storageType,
        albumSetName,
        albumName
      });
      const message = `Invitation sent successfully to ${trimmed}.`;
      setMessage(message);
      setEmail('');
      setEmailTouched(false);
      onInvited?.();
      openReview({ ok: true, email: trimmed, message });
    } catch (err) {
      const message = readPhotoAlbumsInviteError(err, `Failed to send invitation to ${trimmed}.`);
      setError(message);
      openReview({ ok: false, email: trimmed, message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        minWidth: 0,
        flex: { xs: '1 1 100%', md: '0 0 auto' },
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35, flexShrink: 0 }}>
          <SliderControlButton
            type="button"
            variant="green"
            hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
            disabled={!canInvite || busy || (trimmedEmail.length > 0 && !emailFormatValid)}
            onClick={() => void handleInvite()}
            aria-label="Invite by email"
            sx={inviteActionSx}
          >
            Invite
          </SliderControlButton>
          <SliderControlButton
            type="button"
            variant="yellow"
            hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
            disabled={!canInvite}
            onClick={() => openReview(null)}
            aria-label="Review album invites"
            sx={inviteActionSx}
          >
            Review
          </SliderControlButton>
        </Box>
        <TextField
          variant="standard"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError('');
          }}
          onBlur={() => setEmailTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleInvite();
            }
          }}
          placeholder="Share this album with this email"
          disabled={!canInvite || busy}
          error={showEmailFormatError}
          InputProps={{ disableUnderline: true }}
          inputProps={{ 'aria-label': 'Share this album with this email', type: 'email', inputMode: 'email' }}
          sx={inviteFieldSx}
        />
        <SliderControlButton
          type="button"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          disabled={disabled}
          onClick={() => openPhotoAlbumsContextTutorialPopout()}
          aria-label="Open context tutorial"
          title="Open context tutorial in a floating window (stays in sync; drag to another monitor)"
          sx={{
            ...inviteActionSx,
            flexShrink: 0,
            ml: 0,
            mr: '1rem',
            bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`,
            color: '#000 !important',
            WebkitTextFillColor: '#000 !important',
            border: '2px solid #000 !important',
            fontWeight: 800,
            '@media (hover: hover)': {
              '&:hover:not(:disabled)': {
                bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`,
                color: '#000 !important',
                WebkitTextFillColor: '#000 !important'
              }
            }
          }}
        >
          Tutorial
        </SliderControlButton>
      </Box>
      {error ? (
        <Box sx={{ color: '#b71c1c', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.2, pl: 0.25 }}>
          {error}
        </Box>
      ) : message ? (
        <Box sx={{ color: '#1b5e20', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.2, pl: 0.25 }}>
          {message}
        </Box>
      ) : null}
    </Box>
  );
}

PhotoAlbumsInviteBar.propTypes = {
  disabled: PropTypes.bool,
  noteId: PropTypes.number,
  notebookId: PropTypes.number,
  storageType: PropTypes.string,
  albumSetName: PropTypes.string,
  albumName: PropTypes.string,
  onInvited: PropTypes.func,
  onOpenReview: PropTypes.func
};
