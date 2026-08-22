import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { QRCodeSVG } from 'qrcode.react';
import {
  createMobilePhotoUploadSession,
  fetchMobilePhotoUploadSessionStatus
} from 'api/mobilePhotoUploadFe';
import { mobilePhotoUploadDebugLog } from 'utils/mobilePhotoUploadDebug';
import { getScanForPhoneUploadMs } from 'config/phoneUploadScanEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';

export const PROFILE_PHOTO_UPLOAD_QR_INTRO = 'Want use photo from your phone ?';

export const PROFILE_PHOTO_UPLOAD_QR_MESSAGE =
  'You can scan this barcode with your phone to open a secure upload page. Take a photo or pick one from your gallery — it will appear in your album on this computer.';

export const PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE = 'Scan to upload from your phone';

function formatCountdown(remainingMs) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const scanPanelTextSx = {
  color: `var(${INVERSE_DAYNIGHT_VAR})`,
  fontSize: buttonFontSizeResponsive,
  fontWeight: 700,
  lineHeight: 1.2,
  textAlign: 'center'
};

const scanPanelBorderSx = {
  border: '4px solid var(--theme-inverse-daynight-color)',
  borderRadius: 2,
  bgcolor: 'var(--theme-daynight-color)'
};

/**
 * Desktop helper: QR opens /mobilePhotoUpload?token=… on the phone (no phone login required).
 */
export default function ProfilePhotoUploadQrPanel({
  sx,
  messageSx,
  onPhoneUploadComplete,
  disabled = false,
  variant = 'default',
  qrSize: qrSizeProp,
  purpose = 'profile'
}) {
  const inline = variant === 'inline';
  const qrSize = qrSizeProp ?? (inline ? 156 : 168);
  const message = PROFILE_PHOTO_UPLOAD_QR_MESSAGE;
  const uploadPurpose = String(purpose || 'profile').trim().toLowerCase() || 'profile';
  const isPhotoAlbumsPurpose = uploadPurpose === 'photo_albums';
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkMessage, setCheckMessage] = useState('');
  const [watchingUpload, setWatchingUpload] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);
  const lastDeliveredKeyRef = useRef(null);
  const autoRefreshingRef = useRef(false);

  const loadSession = useCallback(async ({ resetDelivery = true, keepCheckMessage = false } = {}) => {
    setLoading(true);
    setError('');
    if (!keepCheckMessage) setCheckMessage('');
    setWatchingUpload(false);
    setRemainingMs(null);
    if (resetDelivery) lastDeliveredKeyRef.current = null;
    try {
      const data = await createMobilePhotoUploadSession(
        isPhotoAlbumsPurpose ? { purpose: 'photo_albums' } : {}
      );
      mobilePhotoUploadDebugLog('desktop QR session created', {
        purpose: data?.purpose,
        expiresAt: data?.expiresAt,
        mobileUrl: data?.mobileUrl
      });
      setSession(data);
    } catch (err) {
      setSession(null);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Could not create phone upload link.';
      mobilePhotoUploadDebugLog('desktop QR session FAIL', {
        message: errMsg,
        status: err?.response?.status
      });
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [isPhotoAlbumsPurpose]);

  useEffect(() => {
    if (disabled) return;
    void loadSession();
  }, [disabled, loadSession]);

  useEffect(() => {
    if (!session?.expiresAt) {
      setRemainingMs(null);
      return undefined;
    }
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const tick = () => {
      setRemainingMs(expiresAtMs - Date.now());
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (disabled || loading || !session?.expiresAt) return undefined;
    if (remainingMs === null || remainingMs > 0) return undefined;
    if (autoRefreshingRef.current) return undefined;

    autoRefreshingRef.current = true;
    void loadSession({ resetDelivery: false, keepCheckMessage: true }).finally(() => {
      autoRefreshingRef.current = false;
    });
    return undefined;
  }, [disabled, loading, loadSession, remainingMs, session?.expiresAt]);

  const applyUploadStatus = useCallback(
    async (status) => {
      const statusPurpose = String(status?.purpose || uploadPurpose).trim().toLowerCase();
      const albumsFlow = isPhotoAlbumsPurpose || statusPurpose === 'photo_albums';

      if (albumsFlow) {
        if (status?.completed) {
          const deliveryKey = `albums:${status?.fileName || status?.completedAt || 'done'}`;
          if (lastDeliveredKeyRef.current !== deliveryKey) {
            lastDeliveredKeyRef.current = deliveryKey;
            setCheckMessage('Photo received from your phone.');
            await onPhoneUploadComplete?.(status?.fileName || status?.photosId, {
              purpose: 'photo_albums',
              fileName: status?.fileName || null,
              photosId: status?.photosId ?? null,
              replacedDuplicate: Boolean(status?.replacedDuplicate)
            });
          }
          return 'completed';
        }
        if (status?.expired) {
          setWatchingUpload(false);
          if (!autoRefreshingRef.current) {
            autoRefreshingRef.current = true;
            void loadSession({ resetDelivery: false, keepCheckMessage: true }).finally(() => {
              autoRefreshingRef.current = false;
            });
          }
          return 'expired';
        }
        return 'pending';
      }

      const photosId = Number(status?.photosId);
      if (status?.completed && Number.isFinite(photosId) && photosId >= 1) {
        if (lastDeliveredKeyRef.current !== photosId) {
          lastDeliveredKeyRef.current = photosId;
          setCheckMessage('Photo received from your phone.');
          await onPhoneUploadComplete?.(photosId, {
            purpose: statusPurpose || 'profile',
            fileName: status?.fileName || null,
            photosId,
            replacedDuplicate: Boolean(status?.replacedDuplicate)
          });
        }
        return 'completed';
      }
      if (status?.expired) {
        setWatchingUpload(false);
        if (!autoRefreshingRef.current) {
          autoRefreshingRef.current = true;
          void loadSession({ resetDelivery: false, keepCheckMessage: true }).finally(() => {
            autoRefreshingRef.current = false;
          });
        }
        return 'expired';
      }
      return 'pending';
    },
    [isPhotoAlbumsPurpose, loadSession, onPhoneUploadComplete, uploadPurpose]
  );

  const checkUploadStatus = useCallback(async () => {
    if (!session?.token) return 'idle';
    try {
      const status = await fetchMobilePhotoUploadSessionStatus(session.token);
      if (status?.completed) {
        mobilePhotoUploadDebugLog('desktop poll completed', {
          photosId: status?.photosId,
          fileName: status?.fileName,
          purpose: status?.purpose
        });
      }
      return await applyUploadStatus(status);
    } catch (pollErr) {
      mobilePhotoUploadDebugLog('desktop poll error', { message: pollErr?.message });
      return 'error';
    }
  }, [applyUploadStatus, session?.token]);

  useEffect(() => {
    if (disabled || loading || !session?.token) {
      setWatchingUpload(false);
      return undefined;
    }

    setWatchingUpload(true);

    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void checkUploadStatus();
    };

    const pollMs = getScanForPhoneUploadMs();
    const initialId = window.setTimeout(poll, pollMs);
    const intervalId = window.setInterval(poll, pollMs);

    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
      setWatchingUpload(false);
    };
  }, [checkUploadStatus, disabled, loading, session?.token]);

  const countdownLabel =
    remainingMs !== null
      ? `New barcode in ${formatCountdown(remainingMs)}`
      : loading && session?.expiresAt
        ? 'New barcode in 0:00'
        : null;

  if (disabled) return null;

  if (inline) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: { xs: 200, md: 'clamp(140px, 14vw, 200px)' },
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
          overflow: 'hidden',
          ...scanPanelBorderSx,
          ...sx
        }}
      >
        <Box sx={{ flexShrink: 0, pt: { xs: 1.25, md: 1.5 }, px: 1 }}>
          <Typography sx={scanPanelTextSx}>Scan to upload</Typography>
          <Typography sx={{ ...scanPanelTextSx, mt: 0.25 }}>From your phone</Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 1,
            py: 0.5,
            minHeight: 0
          }}
        >
          {loading ? (
            <CircularProgress size={36} sx={{ color: `var(${INVERSE_DAYNIGHT_VAR})` }} />
          ) : error ? (
            <Typography sx={{ ...scanPanelTextSx, px: 1, fontWeight: 600 }}>{error}</Typography>
          ) : session?.mobileUrl ? (
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                bgcolor: '#fff',
                p: 1,
                borderRadius: 1.5,
                maxWidth: '100%'
              }}
            >
              <Box sx={{ lineHeight: 0 }}>
                <QRCodeSVG
                  value={session.mobileUrl}
                  size={qrSize}
                  level="M"
                  role="img"
                  aria-label="QR code to upload a profile photo from your phone"
                />
              </Box>
            </Box>
          ) : null}
        </Box>

        <Box
          sx={{
            flexShrink: 0,
            width: '100%',
            py: { xs: 1, md: 1.25 },
            px: 1,
            borderTop: '2px solid var(--theme-inverse-daynight-color)'
          }}
        >
          {countdownLabel ? (
            <Typography sx={{ ...scanPanelTextSx, width: '100%' }}>{countdownLabel}</Typography>
          ) : null}
          {checkMessage ? (
            <Typography sx={{ ...scanPanelTextSx, mt: 0.5, fontWeight: 600, width: '100%' }}>
              {checkMessage}
            </Typography>
          ) : null}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, textAlign: 'center', ...sx }}>
      <Typography
        variant="body2"
        sx={{
          mb: 1,
          lineHeight: 1.45,
          fontWeight: 700,
          ...messageSx
        }}
      >
        {PROFILE_PHOTO_UPLOAD_QR_INTRO}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          mb: 1.5,
          lineHeight: 1.45,
          ...messageSx
        }}
      >
        {message}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 1.5, textAlign: 'left' }}>
          {error}
        </Alert>
      ) : null}

      {session?.mobileUrl ? (
        <>
          <Box sx={{ mb: 1.5 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                bgcolor: '#fff',
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'grey.300'
              }}
            >
              <QRCodeSVG
                value={session.mobileUrl}
                size={qrSize}
                level="M"
                role="img"
                aria-label="QR code to upload a profile photo from your phone"
              />
            </Box>
            {countdownLabel ? (
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  color: '#c62828',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  ...messageSx
                }}
              >
                {countdownLabel}
              </Typography>
            ) : null}
          </Box>
          {watchingUpload && !checkMessage ? (
            <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.45, opacity: 0.9, ...messageSx }}>
              Waiting for upload from your phone — it will appear in Uploaded automatically.
            </Typography>
          ) : null}
          {checkMessage ? (
            <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.45, ...messageSx }}>
              {checkMessage}
            </Typography>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

ProfilePhotoUploadQrPanel.propTypes = {
  sx: PropTypes.object,
  messageSx: PropTypes.object,
  onPhoneUploadComplete: PropTypes.func,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'inline']),
  qrSize: PropTypes.number,
  purpose: PropTypes.string
};
