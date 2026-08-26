import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import GreenButton from 'ui-component/GreenButton';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { themedConfirm } from 'utils/themedDialog';
import {
  fetchPhotoAlbumsStorageConfig,
  fetchPhotoAlbumsTutaDriveStatus,
  formatPhotoAlbumsTutaDrive,
  readPhotoAlbumsApiError,
  unlockPhotoAlbumsTutaDrive
} from 'api/photoAlbumsFe';
import TutaPhotoAlbumsBrandTitle from './TutaPhotoAlbumsBrandTitle';
import {
  TUTAPHOTOALBUMS_CLOUD_LOGO,
  TUTAPHOTOALBUMS_TUTADRIVE_LOGIN_TITLE,
  TUTAPHOTOALBUMS_TUTADRIVE_OPEN_LABEL,
  TUTAPHOTOALBUMS_TUTADRIVE_STRIP_COLOR,
  TUTAPHOTOALBUMS_TUTADRIVE_WORKSPACE_TITLE,
  tutaPhotoAlbumsHalfPanelSx
} from './tutaPhotoAlbumsBranding';
import {
  tutaPhotoAlbumsMoreChoicesButtonSx,
  tutaPhotoAlbumsPostLoginActionButtonSx,
  tutaPhotoAlbumsPostLoginButtonRowSx,
  tutaPhotoAlbumsFormatPostLoginButtonSx
} from './tutaPhotoAlbumsPostLoginActionButtonSx';

/**
 * Left-panel TutaDrive Cloud gate for TutaPhotoAlbums (LEFT_SIDE=TutaDrive).
 * Same centered layout as TutaNotes TutaDrive — no OneDrive email/OAuth.
 */
export default function PhotoAlbumsTutaDriveGate({
  open,
  embedded = false,
  onUnlocked,
  onOpenClicked,
  proceedOpenToken = 0,
  accessFormatRefreshToken = 0
}) {
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Opening TutaDrive');
  const [error, setError] = useState('');
  const [memberFolder, setMemberFolder] = useState('');
  const [showMoreChoices, setShowMoreChoices] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const lastProceedRef = useRef(0);
  const lastFormatRefreshRef = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchPhotoAlbumsTutaDriveStatus();
      setMemberFolder(String(status?.tutadrive?.memberFolder || '').trim());
      if (status?.session?.unlocked) {
        onUnlocked?.();
      }
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Unable to load TutaDrive status'));
    } finally {
      setStatusLoaded(true);
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (!open) {
      setStatusLoaded(false);
      setError('');
      setShowMoreChoices(false);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        await fetchPhotoAlbumsStorageConfig();
      } catch {
        // optional
      }
      if (!cancelled) await refreshStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [open, refreshStatus]);

  const openVaultAfterAccess = useCallback(async () => {
    setBusy(true);
    setBusyLabel('Opening TutaDrive Cloud');
    setError('');
    try {
      await unlockPhotoAlbumsTutaDrive();
      onUnlocked?.();
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Unable to open TutaDrive'));
    } finally {
      setBusy(false);
    }
  }, [onUnlocked]);

  const handleOpen = () => {
    if (busy) return;
    if (onOpenClicked?.() === true) return;
    void openVaultAfterAccess();
  };

  useEffect(() => {
    if (!proceedOpenToken || proceedOpenToken === lastProceedRef.current) return;
    lastProceedRef.current = proceedOpenToken;
    void openVaultAfterAccess();
  }, [proceedOpenToken, openVaultAfterAccess]);

  useEffect(() => {
    if (!accessFormatRefreshToken || accessFormatRefreshToken === lastFormatRefreshRef.current) {
      return;
    }
    lastFormatRefreshRef.current = accessFormatRefreshToken;
    setError('TutaDrive vault was formatted after five incorrect Encrypt Password attempts.');
    void refreshStatus();
  }, [accessFormatRefreshToken, refreshStatus]);

  const handleFormat = async () => {
    if (busy) return;
    const ok = await themedConfirm(
      `Format TutaDrive for ${memberFolder || 'this member'}?\n\nThis deletes photo albums under your member photoalbums folder only.`
    );
    if (!ok) return;
    setBusy(true);
    setBusyLabel('Formatting TutaDrive');
    setError('');
    try {
      await formatPhotoAlbumsTutaDrive();
      await refreshStatus();
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Unable to format TutaDrive'));
    } finally {
      setBusy(false);
    }
  };

  if (!open && !embedded) return null;

  return (
    <>
      <BusyHourglassOverlay
        open={open && busy}
        label={busyLabel}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <Box
        sx={{
          ...tutaPhotoAlbumsHalfPanelSx,
          bgcolor: 'var(--theme-secondary-color)',
          borderRadius: 1,
          border: '2px solid var(--theme-yellow-color)',
          p: 1.5,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}
      >
        <Box
          sx={{
            alignSelf: 'flex-start',
            bgcolor: TUTAPHOTOALBUMS_TUTADRIVE_STRIP_COLOR,
            color: '#fff',
            fontWeight: 800,
            px: 1.25,
            py: 0.5,
            borderRadius: 0.5,
            fontSize: '0.95rem'
          }}
        >
          {TUTAPHOTOALBUMS_TUTADRIVE_WORKSPACE_TITLE}
        </Box>

        <Box
          sx={{
            bgcolor: 'rgba(74, 144, 217, 0.25)',
            borderRadius: 1,
            border: '2px solid #fff',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            flex: 1
          }}
        >
          <TutaPhotoAlbumsBrandTitle
            logoSrc={TUTAPHOTOALBUMS_CLOUD_LOGO}
            title={TUTAPHOTOALBUMS_TUTADRIVE_LOGIN_TITLE}
            sx={{ color: '#fff' }}
          />
          {memberFolder ? (
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
              Member folder: {memberFolder}/photoalbums
            </Typography>
          ) : statusLoaded ? (
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--theme-yellow-color)' }}>
              Member folder will appear after your account has a member number.
            </Typography>
          ) : null}

          {error ? (
            <ColorTemplate16PopupCenterWide.SectionDescription
              sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700, mb: 0 }}
            >
              {error}
            </ColorTemplate16PopupCenterWide.SectionDescription>
          ) : null}

          <Box sx={tutaPhotoAlbumsPostLoginButtonRowSx}>
            {showMoreChoices ? (
              <>
                <GreenButton
                  type="button"
                  singleLineLabel={false}
                  onClick={() => setShowMoreChoices(false)}
                  sx={tutaPhotoAlbumsPostLoginActionButtonSx}
                >
                  Less Choices
                </GreenButton>
                <GreenButton
                  type="button"
                  singleLineLabel={false}
                  disabled={busy}
                  onClick={() => void handleFormat()}
                  sx={tutaPhotoAlbumsFormatPostLoginButtonSx}
                >
                  Format TutaDrive Cloud
                </GreenButton>
              </>
            ) : (
              <>
                <GreenButton
                  type="button"
                  singleLineLabel={false}
                  disabled={busy}
                  onClick={handleOpen}
                  sx={tutaPhotoAlbumsPostLoginActionButtonSx}
                >
                  {busy ? 'Opening…' : TUTAPHOTOALBUMS_TUTADRIVE_OPEN_LABEL}
                </GreenButton>
                <GreenButton
                  type="button"
                  singleLineLabel={false}
                  onClick={() => setShowMoreChoices(true)}
                  sx={tutaPhotoAlbumsMoreChoicesButtonSx}
                >
                  More Choices
                </GreenButton>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}

PhotoAlbumsTutaDriveGate.propTypes = {
  open: PropTypes.bool,
  embedded: PropTypes.bool,
  onUnlocked: PropTypes.func,
  onOpenClicked: PropTypes.func,
  proceedOpenToken: PropTypes.number,
  accessFormatRefreshToken: PropTypes.number
};
