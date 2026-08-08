import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { useAuth } from 'contexts/AuthContext';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { MY_STORY_PATH, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function IntroProfilePhoto({ singlesId, open }) {
  const { user, profilePhotoCacheBust } = useAuth();
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const profilePhotoUrl = useMemo(() => {
    const photoId = Number(user?.profile_image_fk);
    if (Number.isFinite(photoId) && photoId > 0) {
      return `${getApiBaseUrl()}/api/photo/${photoId}?v=${profilePhotoCacheBust}`;
    }
    const numericSinglesId = Number(singlesId);
    if (Number.isFinite(numericSinglesId) && numericSinglesId > 0) {
      return `${getApiBaseUrl()}/api/profile-photo/${numericSinglesId}?v=${profilePhotoCacheBust}`;
    }
    return '';
  }, [singlesId, user?.profile_image_fk, profilePhotoCacheBust]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setPhotoDataUrl('');
    setLoadFailed(false);

    if (!profilePhotoUrl) {
      setLoadFailed(true);
      return () => {
        cancelled = true;
      };
    }

    fetch(profilePhotoUrl, { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Profile photo failed (${response.status})`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .then((dataUrl) => {
        if (!cancelled) setPhotoDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [profilePhotoUrl, open]);

  if (!photoDataUrl) {
    return (
      <ColorTemplate7PopupLargeDark.BodyText>
        {loadFailed ? 'No profile photo' : 'Loading profile photo…'}
      </ColorTemplate7PopupLargeDark.BodyText>
    );
  }

  return (
    <Box
      component="img"
      src={photoDataUrl}
      alt="Your profile photo"
      sx={{
        width: { xs: 72, sm: 88 },
        height: { xs: 72, sm: 88 },
        objectFit: 'cover',
        border: '2px solid var(--theme-primary-color)',
        borderRadius: 1,
        display: 'block',
        flexShrink: 0
      }}
    />
  );
}

IntroProfilePhoto.propTypes = {
  singlesId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  open: PropTypes.bool
};

export default function RekognitionVerifyIntroDialog({
  open,
  onClose,
  singlesId,
  onNext,
  onEditProfile,
  mandatory = false
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    if (needsProfilePhotoSetup(user)) {
      onClose();
      navigate(MY_STORY_PATH);
    }
  }, [open, user, onClose, navigate]);

  const handleNext = () => {
    if (needsProfilePhotoSetup(user)) {
      onClose();
      navigate(MY_STORY_PATH);
      return;
    }
    onNext();
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      closeOnBackdrop={false}
      showCloseButton={false}
      closeButtonAriaLabel="Close identification verification intro"
      bodyTextAlignLeft
      centeredLeadLines={0}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title sx={{ textAlign: 'left' }}>Identification Verification</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.BodyText>
          Let&apos;s make it official! ✨ It looks like you&apos;re new here or recently updated your profile photo.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText>
          To keep our community safe and verify your account, we&apos;ll quickly match your current profile photo with your
          driver&apos;s license and a live selfie.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText>
          Ready to use the photo below? Click Next to keep going! If you&apos;d like to freshen things up first, just click Edit to
          choose a new one.
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 2,
            width: '100%',
            flexWrap: 'wrap'
          }}
        >
          <IntroProfilePhoto singlesId={singlesId} open={open} />
          {!mandatory ? (
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={onEditProfile}>
              Edit
            </ColorTemplate7PopupLargeDark.ActionButton>
          ) : null}
        </Box>

        <ColorTemplate7PopupLargeDark.BodyText>
          Just a heads-up: Once verified, your profile photo, name, age, and current city will be locked in for 30 days. If you update
          these details after that, your badge will temporarily reset so we can re-verify your new info.
        </ColorTemplate7PopupLargeDark.BodyText>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%', pt: 0.5 }}>
          {!mandatory ? (
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={onClose}>
              Cancel
            </ColorTemplate7PopupLargeDark.ActionButton>
          ) : null}
          <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={handleNext}>
            Next
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

RekognitionVerifyIntroDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  singlesId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onNext: PropTypes.func.isRequired,
  onEditProfile: PropTypes.func.isRequired,
  mandatory: PropTypes.bool
};
