import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  fetchMeasureOneEducationStatus,
  loadMeasureOneLinkScript,
  simulateMeasureOneEducationVerification,
  startMeasureOneEducationVerification,
  syncMeasureOneEducationVerification
} from 'api/measureoneFe';

const verifyNowButtonSx = {
  bgcolor: '#ffc107',
  color: '#000000',
  fontWeight: 700,
  borderRadius: '999px',
  px: 3,
  py: 0.85,
  textTransform: 'none',
  border: '1px solid #f9a825',
  boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
  '&:hover': {
    bgcolor: '#ffb300',
    border: '1px solid #f9a825'
  },
  '&.Mui-disabled': {
    bgcolor: '#ffe082',
    color: '#616161',
    border: '1px solid #f9a825'
  }
};

export { verifyNowButtonSx };

function MeasureOneSuccessState({ institutionLabel, message }) {
  return (
    <Stack spacing={2} alignItems="center" sx={{ py: 4, px: 2, textAlign: 'center' }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          bgcolor: '#1976d2',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 700
        }}
      >
        ✓
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Thank you
      </Typography>
      <Typography sx={{ maxWidth: 420 }}>
        {message ||
          (institutionLabel
            ? `Your ${institutionLabel} account is successfully connected.`
            : 'Your college account is successfully connected.')}
      </Typography>
    </Stack>
  );
}

export default function MeasureOneVerifyDialog({ open, onClose, onVerified }) {
  const widgetHostRef = useRef(null);
  const widgetRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [mockEnabled, setMockEnabled] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [institutionLabel, setInstitutionLabel] = useState('');
  const [session, setSession] = useState(null);
  const [widgetReady, setWidgetReady] = useState(false);

  const resetState = useCallback(() => {
    setLoading(false);
    setSyncing(false);
    setErrorText('');
    setSuccessMessage('');
    setInstitutionLabel('');
    setSession(null);
    setWidgetReady(false);
    widgetRef.current = null;
    if (widgetHostRef.current) {
      widgetHostRef.current.innerHTML = '';
    }
  }, []);

  const syncVerification = useCallback(
    async (datarequestId) => {
      if (!datarequestId || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncing(true);
      setErrorText('');
      try {
        const data = await syncMeasureOneEducationVerification(datarequestId);
        setSuccessMessage(data?.message || 'College verification completed.');
        setInstitutionLabel(data?.education?.institutionLabel || data?.education?.collegeName || '');
        await onVerified?.(data);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 409) {
          setErrorText('MeasureOne is still processing your transcript. Please wait a moment and try again.');
        } else {
          setErrorText(err?.response?.data?.error || err?.message || 'Failed to save college verification');
        }
      } finally {
        syncInFlightRef.current = false;
        setSyncing(false);
      }
    },
    [onVerified]
  );

  const runMockVerification = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    setErrorText('');
    try {
      const data = await simulateMeasureOneEducationVerification();
      setSuccessMessage(data?.message || 'College verification completed (demo).');
      setInstitutionLabel(data?.education?.institutionLabel || data?.education?.collegeName || '');
      await onVerified?.(data);
    } catch (err) {
      setErrorText(err?.response?.data?.error || err?.message || 'Failed to run MeasureOne demo verification');
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [onVerified]);

  const mountWidget = useCallback(
    async (widgetConfig) => {
      if (!widgetHostRef.current) return;
      widgetHostRef.current.innerHTML = '';
      await loadMeasureOneLinkScript(widgetConfig.scriptUrl);

      const widget = document.createElement('m1-link');
      widget.setAttribute(
        'config',
        JSON.stringify({
          access_key: widgetConfig.accessKey,
          host_name: widgetConfig.hostName,
          datarequest_id: widgetConfig.datarequestId,
          branding: {
            styles: {
              primary_dark: '#186793',
              primary_light: '#2e9ccb',
              secondary_color: '#ffffff',
              min_height: '620px'
            }
          },
          options: {
            display_profile: false
          }
        })
      );

      const handleConnected = () => {
        syncVerification(widgetConfig.datarequestId);
      };

      widget.addEventListener('datasourceConnected', handleConnected);
      widget.addEventListener('datasource.connected', handleConnected);

      widgetHostRef.current.appendChild(widget);
      widgetRef.current = widget;
      setWidgetReady(true);
    },
    [syncVerification]
  );

  useEffect(() => {
    if (!open) {
      resetState();
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrorText('');

    (async () => {
      try {
        const status = await fetchMeasureOneEducationStatus();
        if (cancelled) return;
        setConfigured(Boolean(status?.configured));
        setMockEnabled(Boolean(status?.mockEnabled));
        if (!status?.configured) {
          setErrorText(
            'MeasureOne is not configured yet. Add MEASUREONE_CLIENT_ID and MEASUREONE_CLIENT_SECRET to ~/.ssh/be/.env, or use demo mode without credentials.'
          );
          return;
        }

        if (status.mockEnabled) {
          const startData = await startMeasureOneEducationVerification();
          if (cancelled) return;
          setSession(startData);
          setWidgetReady(true);
          return;
        }

        const startData = await startMeasureOneEducationVerification();
        if (cancelled) return;
        setSession(startData);
        await mountWidget(startData.widget);
      } catch (err) {
        if (!cancelled) {
          setErrorText(err?.response?.data?.error || err?.message || 'Failed to start MeasureOne verification');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mountWidget, resetState]);

  const handleClose = () => {
    if (syncing) return;
    onClose?.();
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      closeOnBackdrop={!syncing}
      showCloseButton={!syncing}
      closeButtonAriaLabel="Close MeasureOne verification"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Verify College With MeasureOne</ColorTemplate7PopupLargeDark.Title>

        {errorText ? <ColorTemplate7PopupLargeDark.ErrorBar>{errorText}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        {successMessage ? (
          <MeasureOneSuccessState institutionLabel={institutionLabel} message={successMessage} />
        ) : (
          <Stack spacing={2}>
            <ColorTemplate7PopupLargeDark.BodyText>
              {mockEnabled
                ? 'Demo mode uses mock MeasureOne transcript JSON (University of Virginia sample). Click below to apply verified college fields as if the real widget finished.'
                : 'Log into your university student portal to verify your college name, degree, and graduation date.'}
            </ColorTemplate7PopupLargeDark.BodyText>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : mockEnabled ? (
              <Stack spacing={2} alignItems="center" sx={{ py: 4, px: 2, textAlign: 'center' }}>
                <ColorTemplate7PopupLargeDark.BodyText sx={{ maxWidth: 480 }}>
                  Pretend the student portal connected and MeasureOne returned an academic record. This writes college name,
                  degree, and graduation date into your bio review.
                </ColorTemplate7PopupLargeDark.BodyText>
                <ColorTemplate7PopupLargeDark.ActionButton disabled={syncing} onClick={runMockVerification}>
                  {syncing ? 'Applying Demo Verification…' : 'Run MeasureOne Demo Verification'}
                </ColorTemplate7PopupLargeDark.ActionButton>
              </Stack>
            ) : (
              <>
                <Box
                  ref={widgetHostRef}
                  sx={{
                    minHeight: 620,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: '#0b1f33'
                  }}
                />
                {configured && widgetReady && session?.datarequestId ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <ColorTemplate7PopupLargeDark.ActionButton
                      disabled={syncing}
                      onClick={() => syncVerification(session.datarequestId)}
                    >
                      {syncing ? 'Saving Verification…' : 'Refresh Verification Results'}
                    </ColorTemplate7PopupLargeDark.ActionButton>
                  </Box>
                ) : null}
              </>
            )}
            {syncing ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={22} />
              </Box>
            ) : null}
          </Stack>
        )}

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton disabled={syncing} onClick={handleClose}>
            Close
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
