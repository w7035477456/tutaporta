import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { useCompactLoginViewport } from 'config/compactLoginViewport';
import { useAuth } from 'contexts/AuthContext';
import { MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import {
  clearMobilePostLoginChooserPending,
  markMobileTutaDatesUploadPending,
  markMobileTutaNotesUploadPending,
  markMobileTutaPhotoUploadPending,
  peekMobilePostLoginChooserPending
} from 'utils/mobilePostLoginChoice';

const DESKTOP_RECOMMEND_MESSAGE =
  'We currently development mobile verison of TutaDates/TutaNotes/TutaPhotos.  Until it is available, we recommend you use our desktop version, which is much easier and better experience because larger screensize';

const choiceButtonSx = {
  width: '100%',
  maxWidth: '100%',
  whiteSpace: 'normal',
  lineHeight: 1.25,
  py: 1.25,
  px: 1.5,
  textAlign: 'center'
};

/**
 * After mobile/compact login: pick upload destination or see desktop recommendation.
 */
export default function MobilePostLoginChooserDialog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCompact = useCompactLoginViewport();
  const [open, setOpen] = useState(false);
  const [desktopRecommendOpen, setDesktopRecommendOpen] = useState(false);

  useEffect(() => {
    if (!user || !isCompact) return undefined;
    if (!peekMobilePostLoginChooserPending()) return undefined;
    setOpen(true);
    return undefined;
  }, [user, isCompact]);

  const closeChooser = useCallback(() => {
    clearMobilePostLoginChooserPending();
    setOpen(false);
  }, []);

  const goTutaNotesUpload = useCallback(() => {
    markMobileTutaNotesUploadPending();
    closeChooser();
    navigate(`${MY_RECORD_VAULT_PATH}?mobileUpload=1`, { replace: true });
  }, [closeChooser, navigate]);

  const goTutaPhotoUpload = useCallback(() => {
    markMobileTutaPhotoUploadPending();
    closeChooser();
    navigate('/myPhotoAlbums?mobileUpload=1', { replace: true });
  }, [closeChooser, navigate]);

  const goTutaDatesUpload = useCallback(() => {
    markMobileTutaDatesUploadPending();
    closeChooser();
    navigate('/myStory?mobileUpload=1', { replace: true });
  }, [closeChooser, navigate]);

  const goUseApps = useCallback(() => {
    closeChooser();
    setDesktopRecommendOpen(true);
  }, [closeChooser]);

  if (!user) return null;

  return (
    <>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={closeChooser}
        closeOnBackdrop={false}
        closeButtonAriaLabel="Close mobile choices"
        maxWidth="min(96vw, 420px)"
        centerInWindow
      >
        <ColorTemplate7PopupLargeDark.Title>Mobile upload</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <Typography variant="body2" sx={{ textAlign: 'center', mb: 0.5 }}>
            Choose where to upload a photo, or continue to the apps.
          </Typography>
          <Stack spacing={1.25} sx={{ width: '100%' }}>
            <GreenButton type="button" onClick={goTutaNotesUpload} sx={choiceButtonSx}>
              Upload Photo to TutaNotes
            </GreenButton>
            <GreenButton type="button" onClick={goTutaPhotoUpload} sx={choiceButtonSx}>
              Upload Photo to TutaPhoto
            </GreenButton>
            <GreenButton type="button" onClick={goTutaDatesUpload} sx={choiceButtonSx}>
              Upload photo to TutaDates
            </GreenButton>
            <GreenButton type="button" onClick={goUseApps} sx={choiceButtonSx}>
              Use TutaDates/TutaNotes/TutaPhotos
            </GreenButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={desktopRecommendOpen}
        onClose={() => setDesktopRecommendOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close desktop recommendation"
        maxWidth="min(96vw, 420px)"
        centerInWindow
      >
        <ColorTemplate7PopupLargeDark.Title>Desktop recommended</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {DESKTOP_RECOMMEND_MESSAGE}
          </Typography>
          <GreenButton type="button" onClick={() => setDesktopRecommendOpen(false)} sx={{ ...choiceButtonSx, mt: 1 }}>
            OK
          </GreenButton>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}
