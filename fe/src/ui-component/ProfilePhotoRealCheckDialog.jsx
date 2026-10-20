import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_ACTION_GREEN } from 'config/colorTemplate7PopupLargeDark';
import { useAuth } from 'contexts/AuthContext';
import { getFirstLoginOnboardingPhase } from 'utils/firstLoginOnboarding';
import { MY_STORY_PATH } from 'utils/profilePhotoSetup';
import {
  PROFILE_PHOTO_NOT_REAL_ACK_EVENT,
  PROFILE_PHOTO_NOT_REAL_EVENT,
  PROFILE_PHOTO_NOT_REAL_MESSAGE,
  hasProfilePhotoRecheckPassed,
  markProfilePhotoRecheckPassed,
  recheckProfilePhoto,
  requestProfilePhotoNotRealNotice
} from 'utils/profilePhotoRealCheck';

const RECHECK_PHASES = new Set(['gender', 'alias_secret', 'id_verification']);

/**
 * "Please upload real photo" popup. Also rechecks a profile photo set before the
 * real-photo check existed: onboarding cannot continue past the photo step with an avatar.
 */
export default function ProfilePhotoRealCheckDialog() {
  const { user, loading, updateSessionProfilePhoto } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onRequest = (event) => setMessage(event?.detail?.message || PROFILE_PHOTO_NOT_REAL_MESSAGE);
    window.addEventListener(PROFILE_PHOTO_NOT_REAL_EVENT, onRequest);
    return () => window.removeEventListener(PROFILE_PHOTO_NOT_REAL_EVENT, onRequest);
  }, []);

  const singlesId = user?.singles_id;
  const photosId = Number(user?.profile_image_fk);
  const phase = loading ? null : getFirstLoginOnboardingPhase(user);

  useEffect(() => {
    if (!singlesId || !RECHECK_PHASES.has(phase)) return;
    if (!Number.isFinite(photosId) || photosId < 1) return;
    if (hasProfilePhotoRecheckPassed(singlesId, photosId)) return;
    let cancelled = false;
    recheckProfilePhoto()
      .then((result) => {
        if (cancelled) return;
        if (result?.ok === false) {
          updateSessionProfilePhoto(null);
          requestProfilePhotoNotRealNotice(result.error);
          navigate(MY_STORY_PATH, { replace: true });
          return;
        }
        markProfilePhotoRecheckPassed(singlesId, photosId);
      })
      .catch(() => {
        /* retry on next navigation */
      });
    return () => {
      cancelled = true;
    };
  }, [singlesId, photosId, phase, updateSessionProfilePhoto, navigate]);

  const close = useCallback(() => {
    setMessage('');
    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_NOT_REAL_ACK_EVENT));
  }, []);

  return (
    <ColorTemplate7PopupLargeDark
      open={Boolean(message)}
      onClose={close}
      closeOnBackdrop
      closeButtonAriaLabel="Close real photo notice"
      maxWidth="min(96vw, 460px)"
      centerInWindow
    >
      <ColorTemplate7PopupLargeDark.Title>Real photo required</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <Typography variant="body1" sx={{ textAlign: 'center', lineHeight: 1.45 }}>
          {message}
        </Typography>
        <ColorTemplate7PopupLargeDark.ActionButton
          onClick={close}
          sx={{
            width: '100%',
            mt: 1,
            '&&.MuiButton-root': { bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important` }
          }}
        >
          OK, upload a real photo
        </ColorTemplate7PopupLargeDark.ActionButton>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
