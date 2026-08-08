import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {
  createRekognitionLivenessSession,
  fetchRekognitionLivenessResults,
  fetchRekognitionStatus
} from 'api/rekognitionFe';
import { resolveRekognitionIdentityPoolId } from 'utils/rekognitionIdentityPoolId';
import { formatLiveFaceScanUserError, isLiveScanConfidenceMessage, parseLiveScanConfidenceMessage } from 'utils/livenessErrorMessage';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import {
  LIVE_FACE_SCAN_POPUP_PHASE,
  postLiveFaceScanPopupResult
} from 'utils/liveFaceScanPopupProtocol';
import { getLiveFaceScanPopupWindowSize } from 'utils/openLiveFaceScanPopup';
import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import {
  COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
  COLOR_TEMPLATE7_POPUP_TEXT
} from 'config/colorTemplate7PopupLargeDark';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import useColorTemplate7PopupLargeDarkLayout from 'hooks/useColorTemplate7PopupLargeDarkLayout';
import RekognitionFaceLivenessStep from './RekognitionFaceLivenessStep';
import { IDV_BUTTON_THICK_BLACK_BORDER } from './IdentificationVerificationBoard';

const LIVE_SCAN_POPUP_MAX_WIDTH = COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH;
const LIVE_SCAN_POPUP_UI_SCALE = 3;

function scaleVwFontSize(vwSize, multiplier) {
  const match = /^([\d.]+)vw$/.exec(String(vwSize ?? '').trim());
  if (!match) return `${2 * multiplier}vw`;
  const scaled = Math.min(Number(match[1]) * multiplier, 25);
  return `${scaled}vw`;
}

const liveScanPopupBodyStackSx = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2 * LIVE_SCAN_POPUP_UI_SCALE
};

const cameraCircleSx = {
  width: { xs: 240 * LIVE_SCAN_POPUP_UI_SCALE, sm: 280 * LIVE_SCAN_POPUP_UI_SCALE },
  height: { xs: 240 * LIVE_SCAN_POPUP_UI_SCALE, sm: 280 * LIVE_SCAN_POPUP_UI_SCALE },
  borderRadius: '50%',
  overflow: 'hidden',
  bgcolor: '#000000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const cameraVideoSx = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'scaleX(-1)'
};

const liveScanPopupIdleSurfaceSx = {
  ...liveScanPopupBodyStackSx,
  cursor: 'pointer',
  userSelect: 'none',
  justifyContent: 'flex-start',
  pt: { xs: 1, sm: 1.5 }
};

/** fe/.env DESKTOP_FONT_SIZE_BUTTON — live scan popup idle labels (3× for popup UI scale). */
const liveScanPopupButtonFontSize = scaleVwFontSize(getDesktopButtonFontSizeVw(), LIVE_SCAN_POPUP_UI_SCALE);

/** fe/.env DESKTOP_FONT_SIZE_TEXT — live scan confidence readout. */
const liveScanPopupConfidenceFontSize = getDesktopTextFontSizeVw();

const LIVE_SCAN_ERROR_FONT_SCALE = 4;

/** Scan-fail popup copy — 4× DESKTOP_FONT_SIZE_TEXT. */
const liveScanPopupErrorTextFontSize = scaleVwFontSize(liveScanPopupConfidenceFontSize, LIVE_SCAN_ERROR_FONT_SCALE);

/** Scan-fail popup actions — 4× DESKTOP_FONT_SIZE_BUTTON. */
const liveScanPopupErrorButtonFontSize = scaleVwFontSize(getDesktopButtonFontSizeVw(), LIVE_SCAN_ERROR_FONT_SCALE);

const LIVE_SCAN_CONFIDENCE_FAIL_COLOR = '#c62828';
const LIVE_SCAN_CONFIDENCE_PASS_COLOR = '#2e7d32';

const LIVE_SCAN_BELOW_MINIMUM_FOLLOW_UP =
  'Please try Scan again Or Record a Video and submit to support for manual verification';

const liveScanPopupLabelSx = {
  fontWeight: 700,
  fontSize: liveScanPopupButtonFontSize,
  textAlign: 'center',
  lineHeight: 1.25,
  width: '100%'
};

const dragWindowHintSx = {
  ...liveScanPopupLabelSx,
  lineHeight: 1.35,
  maxWidth: 380 * LIVE_SCAN_POPUP_UI_SCALE,
  px: 1
};

const idlePromptLargeSx = {
  ...liveScanPopupLabelSx
};

const restartScanButtonSx = {
  bgcolor: '#43a047 !important',
  color: '#ffffff !important',
  fontWeight: 700,
  fontSize: liveScanPopupErrorButtonFontSize,
  px: 3,
  py: 1.25,
  flex: '1 1 0',
  minWidth: { xs: 140, sm: 160 },
  '&:hover': { bgcolor: '#388e3c !important' }
};

const liveScanErrorActionsRowSx = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: { xs: 1, sm: 1.5 },
  flexWrap: 'wrap',
  width: '100%',
  maxWidth: 'min(96vw, 720px)',
  px: 1
};

const liveScanErrorOrDividerSx = {
  fontWeight: 900,
  fontSize: liveScanPopupErrorButtonFontSize,
  color: COLOR_TEMPLATE7_POPUP_TEXT,
  WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
  lineHeight: 1,
  flex: '0 0 auto'
};

const liveScanErrorTextBaseSx = {
  fontWeight: 700,
  fontSize: liveScanPopupErrorTextFontSize,
  textAlign: 'center',
  lineHeight: 1.25,
  width: '100%',
  maxWidth: 'min(96vw, 720px)',
  px: 1
};

function liveScanConfidenceMessageSx(belowMinimum) {
  const color = belowMinimum ? LIVE_SCAN_CONFIDENCE_FAIL_COLOR : LIVE_SCAN_CONFIDENCE_PASS_COLOR;
  return {
    ...liveScanErrorTextBaseSx,
    color,
    WebkitTextFillColor: color
  };
}

function liveScanErrorFollowUpSx() {
  return {
    ...liveScanErrorTextBaseSx,
    color: COLOR_TEMPLATE7_POPUP_TEXT,
    WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT
  };
}

function buildLiveScanBelowMinimumConfidenceLine(errorText, livenessMinConfidence) {
  const parsed = parseLiveScanConfidenceMessage(errorText);
  if (parsed && Number.isFinite(parsed.confidence)) {
    const min = parsed.minConfidence ?? livenessMinConfidence;
    const minDisplay = Number.isFinite(Number(min)) ? Math.round(Number(min)) : livenessMinConfidence;
    return `Confident ${parsed.confidence.toFixed(1)}% is below minimum ${minDisplay}%.`;
  }
  const raw = String(errorText ?? '').trim();
  const periodIdx = raw.indexOf('.');
  if (periodIdx > 0) return raw.slice(0, periodIdx + 1);
  return raw;
}

function isLiveScanConfidenceBelowMinimum(errorText, livenessMinConfidence) {
  const parsed = parseLiveScanConfidenceMessage(errorText);
  const threshold = Number(parsed?.minConfidence ?? livenessMinConfidence);
  if (parsed && Number.isFinite(parsed.confidence) && Number.isFinite(threshold)) {
    return parsed.confidence < threshold;
  }
  return /is below minimum/i.test(String(errorText ?? ''));
}

function LiveScanPopupErrorMessage({ errorText, livenessMinConfidence = 90 }) {
  if (!errorText) return null;
  if (isLiveScanConfidenceMessage(errorText)) {
    const belowMinimum = isLiveScanConfidenceBelowMinimum(errorText, livenessMinConfidence);
    if (belowMinimum) {
      const confidenceLine = buildLiveScanBelowMinimumConfidenceLine(errorText, livenessMinConfidence);
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '100%' }}>
          <Typography
            sx={{
              ...liveScanErrorTextBaseSx,
              color: LIVE_SCAN_CONFIDENCE_FAIL_COLOR,
              WebkitTextFillColor: LIVE_SCAN_CONFIDENCE_FAIL_COLOR
            }}
            role="alert"
          >
            {confidenceLine}
          </Typography>
          <ColorTemplate7PopupLargeDark.BodyText sx={liveScanErrorFollowUpSx()}>
            {LIVE_SCAN_BELOW_MINIMUM_FOLLOW_UP}
          </ColorTemplate7PopupLargeDark.BodyText>
        </Box>
      );
    }
    return (
      <Typography sx={liveScanConfidenceMessageSx(belowMinimum)} role="alert">
        {errorText}
      </Typography>
    );
  }
  return (
    <ColorTemplate7PopupLargeDark.BodyText sx={{ ...liveScanErrorTextBaseSx, color: COLOR_TEMPLATE7_POPUP_TEXT }} role="alert">
      {errorText}
    </ColorTemplate7PopupLargeDark.BodyText>
  );
}

function resolveReturnOrigin(searchParams) {
  const raw = String(searchParams.get('returnOrigin') || '').trim();
  if (!raw) return window.location.origin;
  try {
    const parsed = new URL(raw);
    if (parsed.origin === window.location.origin) return parsed.origin;
  } catch {
    // ignore
  }
  return window.location.origin;
}

export default function LiveFaceScanPopupPage() {
  const [searchParams] = useSearchParams();
  const returnOrigin = useMemo(() => resolveReturnOrigin(searchParams), [searchParams]);
  const videoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const postedRef = useRef(false);
  const finishInFlightRef = useRef(false);
  const scanPassedRef = useRef(false);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState(null);
  const [scanStarted, setScanStarted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [identityPoolId, setIdentityPoolId] = useState('');
  const [starting, setStarting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);

  const identityPoolIdForLiveness = useMemo(
    () =>
      resolveRekognitionIdentityPoolId(
        identityPoolId || status?.identityPoolId,
        import.meta.env.VITE_REKOGNITION_IDENTITY_POOL_ID
      ),
    [identityPoolId, status?.identityPoolId]
  );

  const notifyOpener = useCallback(
    (payload) => {
      if (postedRef.current) return;
      postedRef.current = true;
      if (window.opener && !window.opener.closed) {
        postLiveFaceScanPopupResult(window.opener, payload, returnOrigin);
      }
    },
    [returnOrigin]
  );

  const stopPreviewStream = useCallback(() => {
    const stream = previewStreamRef.current;
    previewStreamRef.current = null;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
  }, []);

  useEffect(() => {
    const { width, height } = getLiveFaceScanPopupWindowSize();
    try {
      if (window.outerWidth < width - 48 || window.outerHeight < height - 48) {
        window.resizeTo(width, height);
      }
    } catch {
      // Some browsers block resizeTo on popups.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingStatus(true);
    fetchRekognitionStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorText(
            sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to load verification status')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scanStarted || loadingStatus || errorText) return undefined;

    let cancelled = false;
    setCameraPreviewReady(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraPreviewReady(true);
      } catch (err) {
        if (!cancelled) {
          setErrorText(sanitizeUserFacingTechTerms(err?.message || 'Could not access the camera.'));
        }
      }
    })();

    return () => {
      cancelled = true;
      stopPreviewStream();
    };
  }, [scanStarted, loadingStatus, errorText, stopPreviewStream]);

  useEffect(() => {
    const onBeforeUnload = () => {
      notifyOpener({ phase: LIVE_FACE_SCAN_POPUP_PHASE.CLOSED });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      stopPreviewStream();
    };
  }, [notifyOpener, stopPreviewStream]);

  const resetForNewScan = useCallback(() => {
    postedRef.current = false;
    finishInFlightRef.current = false;
    scanPassedRef.current = false;
    setScanStarted(false);
    setSessionId('');
    setRegion('us-east-1');
    setIdentityPoolId('');
    setStarting(false);
    setErrorText('');
  }, []);

  const finishWithPass = useCallback(
    async (activeSessionId, activeRegion, activeIdentityPoolId) => {
      if (finishInFlightRef.current || postedRef.current) return;
      finishInFlightRef.current = true;
      try {
        const checkResult = await fetchRekognitionLivenessResults(activeSessionId);
        if (!checkResult?.passed) {
          const reason = formatLiveFaceScanUserError(
            {
              message: checkResult?.passFailReason,
              checkResult
            },
            status?.livenessMinConfidence ?? 90
          );
          setErrorText(reason);
          notifyOpener({
            phase: LIVE_FACE_SCAN_POPUP_PHASE.FAILED,
            message: reason,
            sessionId: activeSessionId,
            checkResult
          });
          return;
        }
        scanPassedRef.current = true;
        notifyOpener({
          phase: LIVE_FACE_SCAN_POPUP_PHASE.PASSED,
          sessionId: activeSessionId,
          region: activeRegion,
          identityPoolId: activeIdentityPoolId,
          checkResult
        });
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 400);
      } catch (err) {
        const msg = sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Liveness check failed');
        setErrorText(msg);
        notifyOpener({ phase: LIVE_FACE_SCAN_POPUP_PHASE.ERROR, message: msg });
      } finally {
        finishInFlightRef.current = false;
      }
    },
    [notifyOpener, status?.livenessMinConfidence]
  );

  const handleLivenessComplete = useCallback(() => {
    void finishWithPass(sessionId, region, identityPoolId || status?.identityPoolId || '');
  }, [finishWithPass, sessionId, region, identityPoolId, status?.identityPoolId]);

  const handleLivenessWidgetError = useCallback((msg) => {
    if (finishInFlightRef.current || scanPassedRef.current || postedRef.current) return;
    const text = typeof msg === 'string' ? msg : sanitizeUserFacingTechTerms('Liveness error');
    setErrorText(text);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (scanStarted || starting || loadingStatus || errorText) return;
    if (status && !status.configured) {
      setErrorText('Identity verification is not available right now.');
      return;
    }
    if (status?.requireLiveness && !status?.livenessConfigured) {
      setErrorText('Face liveness is not set up on this site yet.');
      return;
    }

    setStarting(true);
    setErrorText('');
    stopPreviewStream();
    postedRef.current = false;
    finishInFlightRef.current = false;
    scanPassedRef.current = false;

    try {
      const data = await createRekognitionLivenessSession();
      const nextSessionId = String(data?.sessionId || '');
      const nextRegion = String(data?.region || status?.region || 'us-east-1');
      const nextIdentityPoolId = String(data?.identityPoolId || status?.identityPoolId || '');
      const poolId = resolveRekognitionIdentityPoolId(
        nextIdentityPoolId || status?.identityPoolId,
        import.meta.env.VITE_REKOGNITION_IDENTITY_POOL_ID
      );
      if (!nextSessionId) throw new Error('No liveness session id returned');
      if (!poolId) {
        throw new Error(
          'Face liveness identity pool is not configured. Set REKOGNITION_COGNITO_IDENTITY_POOL_ID in ~/.ssh/be/.env and restart the API.'
        );
      }
      setSessionId(nextSessionId);
      setRegion(nextRegion);
      setIdentityPoolId(nextIdentityPoolId);
      setScanStarted(true);
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to start face liveness');
      setErrorText(msg);
      notifyOpener({ phase: LIVE_FACE_SCAN_POPUP_PHASE.ERROR, message: msg });
    } finally {
      setStarting(false);
    }
  }, [scanStarted, starting, loadingStatus, errorText, status, stopPreviewStream, notifyOpener]);

  const { overlaySx, panelShellSx } = useColorTemplate7PopupLargeDarkLayout({
    maxWidth: LIVE_SCAN_POPUP_MAX_WIDTH,
    centerInGallery: true
  });

  const liveScanPopupPanelShellSx = {
    ...panelShellSx,
    width: 'calc(100vw - 24px)',
    maxWidth: 'calc(100vw - 24px)',
    minHeight: COLOR_TEMPLATE7_POPUP_MAX_HEIGHT
  };

  const liveScanPopupOverlaySx = {
    ...overlaySx,
    position: 'fixed',
    minHeight: '100vh'
  };

  const handlePopupClose = useCallback(() => {
    notifyOpener({ phase: LIVE_FACE_SCAN_POPUP_PHASE.CLOSED });
    try {
      window.close();
    } catch {
      // ignore
    }
  }, [notifyOpener]);

  const handleSubmitVideo = useCallback(() => {
    const message =
      errorText ||
      buildLiveScanBelowMinimumConfidenceLine(errorText, status?.livenessMinConfidence ?? 90);
    if (window.opener && !window.opener.closed) {
      postLiveFaceScanPopupResult(
        window.opener,
        { phase: LIVE_FACE_SCAN_POPUP_PHASE.SUBMIT_VIDEO, message },
        returnOrigin
      );
    }
    try {
      window.close();
    } catch {
      // ignore
    }
  }, [errorText, returnOrigin, status?.livenessMinConfidence]);

  const renderPopupBody = () => {
    if (loadingStatus) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (scanStarted && sessionId) {
      if (errorText) {
        const belowMinimum =
          isLiveScanConfidenceMessage(errorText) &&
          isLiveScanConfidenceBelowMinimum(errorText, status?.livenessMinConfidence ?? 90);

        return (
          <Box sx={liveScanPopupBodyStackSx}>
            <LiveScanPopupErrorMessage
              errorText={errorText}
              livenessMinConfidence={status?.livenessMinConfidence ?? 90}
            />
            {belowMinimum ? (
              <Box sx={liveScanErrorActionsRowSx}>
                <ColorTemplate7PopupLargeDark.ActionButton
                  thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
                  sx={restartScanButtonSx}
                  onClick={resetForNewScan}
                >
                  Record Again
                </ColorTemplate7PopupLargeDark.ActionButton>
                <Box component="span" sx={liveScanErrorOrDividerSx} aria-hidden>
                  OR
                </Box>
                <ColorTemplate7PopupLargeDark.ActionButton
                  thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
                  sx={restartScanButtonSx}
                  onClick={handleSubmitVideo}
                >
                  Submit Video
                </ColorTemplate7PopupLargeDark.ActionButton>
              </Box>
            ) : (
              <ColorTemplate7PopupLargeDark.ActionButton
                thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
                sx={restartScanButtonSx}
                onClick={resetForNewScan}
              >
                Record Again
              </ColorTemplate7PopupLargeDark.ActionButton>
            )}
          </Box>
        );
      }

      return (
        <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <RekognitionFaceLivenessStep
            key={sessionId}
            sessionId={sessionId}
            region={region}
            identityPoolId={identityPoolIdForLiveness}
            livenessAlreadyPassed={scanPassedRef.current}
            showInlineErrors={false}
            onComplete={handleLivenessComplete}
            onError={handleLivenessWidgetError}
          />
        </Box>
      );
    }

    return (
      <Box
        sx={liveScanPopupIdleSurfaceSx}
        role="button"
        tabIndex={0}
        aria-label="Click anywhere to start live scan"
        onClick={() => void handleStartScan()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void handleStartScan();
          }
        }}
      >
        <ColorTemplate7PopupLargeDark.BodyText sx={dragWindowHintSx}>
          Please drag this window next to Camera for direct eye to camera line of sight
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box sx={cameraCircleSx}>
          {starting ? (
            <CircularProgress sx={{ color: '#ffffff', width: 144, height: 144 }} />
          ) : (
            <Box
              component="video"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              sx={cameraVideoSx}
              aria-hidden={!cameraPreviewReady}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '100%' }}>
          <ColorTemplate7PopupLargeDark.BodyText sx={idlePromptLargeSx}>Center your face</ColorTemplate7PopupLargeDark.BodyText>
          <ColorTemplate7PopupLargeDark.BodyText sx={idlePromptLargeSx}>
            Click anywhere to start live scan
          </ColorTemplate7PopupLargeDark.BodyText>
        </Box>

        {errorText ? (
          <Box sx={{ width: '100%', maxWidth: 520, mt: 0.5 }}>
            <LiveScanPopupErrorMessage
              errorText={errorText}
              livenessMinConfidence={status?.livenessMinConfidence ?? 90}
            />
          </Box>
        ) : null}
      </Box>
    );
  };

  return (
    <ColorTemplate7PopupLargeDark
      open
      onClose={handlePopupClose}
      maxWidth={LIVE_SCAN_POPUP_MAX_WIDTH}
      closeOnBackdrop={false}
      overlaySx={liveScanPopupOverlaySx}
      panelShellSx={liveScanPopupPanelShellSx}
    >
      <ColorTemplate7PopupLargeDark.Title>Live Face Scan</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body>{renderPopupBody()}</ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
