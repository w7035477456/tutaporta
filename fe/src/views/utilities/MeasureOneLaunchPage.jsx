import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import { loadMeasureOneLinkScript, syncMeasureOneEducationVerification } from 'api/measureoneFe';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { verifyNowButtonSx } from './MeasureOneVerifyDialog';

export default function MeasureOneLaunchPage() {
  const [searchParams] = useSearchParams();
  const widgetHostRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const [errorText, setErrorText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const accessKey = searchParams.get('access_key') || '';
  const hostName = searchParams.get('host_name') || '';
  const datarequestId = searchParams.get('datarequest_id') || '';
  const scriptUrl = searchParams.get('script_url') || '';

  const syncVerification = useCallback(async (requestId) => {
    if (!requestId || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    setErrorText('');
    try {
      const data = await syncMeasureOneEducationVerification(requestId);
      setSuccessMessage(data?.message || 'College verification completed.');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setErrorText('MeasureOne is still processing your transcript. Please wait a moment and try again.');
      } else {
        setErrorText(err?.response?.data?.error || err?.message || 'Failed to save verification results.');
      }
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!accessKey || !hostName || !datarequestId || !scriptUrl) {
      setErrorText('This MeasureOne link is incomplete. Return to My Self-Report-Bio and click MeasureOne again.');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrorText('');

    (async () => {
      try {
        await loadMeasureOneLinkScript(scriptUrl);
        if (cancelled || !widgetHostRef.current) return;

        widgetHostRef.current.innerHTML = '';
        const widget = document.createElement('m1-link');
        widget.setAttribute(
          'config',
          JSON.stringify({
            access_key: accessKey,
            host_name: hostName,
            datarequest_id: datarequestId,
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
          syncVerification(datarequestId);
        };
        widget.addEventListener('datasourceConnected', handleConnected);
        widget.addEventListener('datasource.connected', handleConnected);
        widgetHostRef.current.appendChild(widget);
      } catch (err) {
        if (!cancelled) {
          setErrorText(err?.message || 'Failed to load MeasureOne.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessKey, hostName, datarequestId, scriptUrl, syncVerification]);

  return (
    <MainCard
      title={
        <Typography sx={{ fontSize: { xs: '1.1rem', sm: getDesktopTitleFontSizeVw() }, color: 'var(--theme-primary-color)' }}>
          MeasureOne College Verification
        </Typography>
      }
    >
      <Stack spacing={2}>
        <Typography sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
          Log into your university student portal to verify your college name, degree, and graduation date.
        </Typography>
        {errorText ? <Alert severity="error">{errorText}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
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
            {datarequestId ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" sx={verifyNowButtonSx} disabled={syncing} onClick={() => syncVerification(datarequestId)}>
                  {syncing ? 'Saving Verification…' : 'Refresh Verification Results'}
                </Button>
                <Button component={RouterLink} to={SELF_REPORT_BIOGRAPHY_PATH} variant="outlined">
                  Back to My Self-Report-Bio
                </Button>
              </Box>
            ) : null}
          </>
        )}
      </Stack>
    </MainCard>
  );
}
