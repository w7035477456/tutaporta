import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CheckIcon from '@mui/icons-material/Check';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS } from 'config/selectedUnselectedButtonTemplate';
import { ConsentDisclaimerBody, getConsentCheckboxLabel } from 'constants/consentDisclaimerContent';
import { useGetRequestsAboutMeSettings } from 'api/requestsAboutMeFe';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { captureConsentDialogImage } from 'utils/captureConsentDialogImage';
import { useUserTimeZoneProfile } from 'hooks/useUserTimeZoneProfile';
import { formatUserDateTime } from 'utils/userTimeZone';
import { themedAlert } from 'utils/themedDialog';

/**
 * Consent surfaces are fixed colors, not theme vars: this panel is captured to a
 * PNG legal record, so the signed image must look the same on every theme.
 */
const CONSENT_SURFACE_YELLOW = '#FFEB3B';
const CONSENT_SURFACE_WHITE = '#FFFFFF';
const CONSENT_SURFACE_TEXT = '#000000';

const consentSurfaceSx = (bgcolor) => ({
  bgcolor,
  color: CONSENT_SURFACE_TEXT,
  WebkitTextFillColor: CONSENT_SURFACE_TEXT,
  border: `1px solid ${CONSENT_SURFACE_TEXT}`,
  borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
  boxSizing: 'border-box'
});

const yellowControlSurfaceSx = consentSurfaceSx(CONSENT_SURFACE_YELLOW);
const whiteControlSurfaceSx = consentSurfaceSx(CONSENT_SURFACE_WHITE);

/** Viewer Approved / Date are read-only but must still render white, not MUI grey. */
const disabledConsentFieldSx = {
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none'
  },
  '& .MuiInputBase-root': {
    ...whiteControlSurfaceSx
  },
  '& .MuiInputBase-root.Mui-disabled': {
    ...whiteControlSurfaceSx
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: CONSENT_SURFACE_TEXT,
    color: CONSENT_SURFACE_TEXT
  },
  '& .MuiInputLabel-root.Mui-disabled': {
    color: CONSENT_SURFACE_TEXT
  }
};

const consentCheckboxBoxSx = {
  ...yellowControlSurfaceSx,
  width: 72,
  height: 72,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

function ConsentCheckboxIcon({ checked = false }) {
  return (
    <Box className="consent-checkbox-capture-surface" sx={consentCheckboxBoxSx}>
      {checked ? <CheckIcon sx={{ color: 'inherit', fontSize: 48 }} /> : null}
    </Box>
  );
}

const consentFullNameFieldSx = {
  flex: 1,
  minWidth: 0,
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none'
  },
  '& .MuiInputBase-root': {
    ...whiteControlSurfaceSx,
    fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() }
  },
  '& .MuiInputBase-input': {
    color: 'inherit',
    WebkitTextFillColor: 'inherit'
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'inherit',
    opacity: 0.72
  },
  '& .MuiInputBase-root.Mui-focused': {
    ...whiteControlSurfaceSx
  }
};

const consentNameMatchLabelSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  pointerEvents: 'none',
  cursor: 'default',
  userSelect: 'none',
  fontWeight: 700,
  fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() }
};

const consentNameMatchCheckSx = {
  color: '#4CAF50',
  fontSize: { xs: '1.1rem', sm: '1.25rem' }
};

const consentNameMatchTextSx = {
  color: '#4CAF50',
  WebkitTextFillColor: '#4CAF50',
  WebkitTextStroke: '1px #000000',
  paintOrder: 'stroke fill'
};

const consentNameMismatchLabelSx = {
  color: '#e53935',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  border: '1px solid #000000',
  borderRadius: '4px',
  px: 1,
  py: 0.5,
  fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() },
  pointerEvents: 'none',
  cursor: 'default',
  userSelect: 'none'
};

const consentSignaturePanelSx = {
  ...yellowControlSurfaceSx,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden'
};

const consentSignatureCaptionSx = {
  px: 1,
  py: 0.65,
  color: `${CONSENT_SURFACE_TEXT} !important`,
  WebkitTextFillColor: `${CONSENT_SURFACE_TEXT} !important`,
  fontWeight: 700,
  fontSize: { xs: '0.8rem', sm: getDesktopTextFontSizeVw() },
  borderTop: `1px solid ${CONSENT_SURFACE_TEXT}`,
  textAlign: 'center',
  overflowWrap: 'anywhere'
};

const consentFieldRowSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { xs: 'stretch', sm: 'center' },
  gap: { xs: 0.75, sm: 2.5 },
  width: '100%'
};

const consentFieldLabelSx = {
  flex: { sm: '0 0 280px' },
  fontWeight: 700,
  whiteSpace: { xs: 'normal', sm: 'nowrap' },
  fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() },
  textAlign: { xs: 'left', sm: 'right' },
  pr: { sm: 0.5 }
};

const consentFieldValueSx = {
  flex: 1,
  minWidth: 0
};

function formatConsentDate(value = new Date(), userTimeZoneProfile = null) {
  return formatUserDateTime(value, userTimeZoneProfile || {});
}

function normalizeNameForMatch(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function canvasHasSignatureInk(canvas) {
  if (!canvas) return false;
  const context = canvas.getContext('2d');
  if (!context) return false;

  const { width, height } = canvas;
  if (width <= 0 || height <= 0) return false;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  if (data.length < 4) return false;

  const referenceR = data[0];
  const referenceG = data[1];
  const referenceB = data[2];
  const threshold = 18;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 16) continue;
    if (
      Math.abs(r - referenceR) > threshold ||
      Math.abs(g - referenceG) > threshold ||
      Math.abs(b - referenceB) > threshold
    ) {
      return true;
    }
  }
  return false;
}

function namesMatch(typedName, expectedFullName, enforceExpectedMatch) {
  const typed = normalizeNameForMatch(typedName);
  const expected = normalizeNameForMatch(expectedFullName);
  if (!enforceExpectedMatch) {
    return typed.length > 0;
  }
  if (!expected || !typed) {
    return false;
  }
  return typed === expected;
}

export default function VerificationAuthorizationDialog({
  open,
  onConfirm,
  onCancel,
  confirmBusy = false,
  viewerApprovedLabel = '',
  viewerApprovedId = null,
  dateSigned = null,
  expectedFullName,
  showViewerApproved = true,
  scrollToBottomOnOpen = false
}) {
  const userTimeZoneProfile = useUserTimeZoneProfile();
  const captureRef = useRef(null);
  const submitActionsRef = useRef(null);
  const signaturePanelRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const signatureDrawingRef = useRef(false);
  const [releaseAuthorized, setReleaseAuthorized] = useState(false);
  const [fullNameSigned, setFullNameSigned] = useState('');
  const [signatureInkDetected, setSignatureInkDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const enforceFullNameMatch = expectedFullName !== undefined && expectedFullName !== null;
  const resolvedDateSigned = useMemo(
    () => formatConsentDate(dateSigned || new Date(), userTimeZoneProfile),
    [dateSigned, open, userTimeZoneProfile]
  );
  const fullNameMatches = useMemo(
    () => namesMatch(fullNameSigned, expectedFullName, enforceFullNameMatch),
    [fullNameSigned, expectedFullName, enforceFullNameMatch]
  );
  const showNameMismatch = useMemo(() => {
    if (!enforceFullNameMatch) return false;
    const typed = normalizeNameForMatch(fullNameSigned);
    const expected = normalizeNameForMatch(expectedFullName);
    return Boolean(expected && typed && typed !== expected);
  }, [fullNameSigned, expectedFullName, enforceFullNameMatch]);
  const showNameMatch = useMemo(() => {
    if (!enforceFullNameMatch) return false;
    const typed = normalizeNameForMatch(fullNameSigned);
    return Boolean(typed && fullNameMatches);
  }, [fullNameSigned, fullNameMatches, enforceFullNameMatch]);
  const resolvedExpectedFullName = String(expectedFullName ?? '').trim();
  const signatureDisplayName =
    String(fullNameSigned).trim() || (enforceFullNameMatch ? resolvedExpectedFullName : '') || 'First MiddleInitial Last';
  const signatureCaption = `Signature of ${signatureDisplayName} ${resolvedDateSigned}`;
  const fullNamePlaceholder = resolvedExpectedFullName || 'First MiddleInitial Last';
  const { approvedViewingDurationMonths } = useGetRequestsAboutMeSettings();

  const refreshSignatureInk = useCallback(() => {
    setSignatureInkDetected(canvasHasSignatureInk(signatureCanvasRef.current));
  }, []);

  const submitBlockReason = useMemo(() => {
    if (confirmBusy) return 'Saving your consent…';
    if (capturing) return 'Capturing consent screen…';
    if (!releaseAuthorized) return 'Check the consent box above to enable Submit Consent.';
    if (!fullNameMatches) {
      return enforceFullNameMatch
        ? `Type your legal name exactly as shown on your self-report bio (${expectedFullName}).`
        : 'Type your full name to continue.';
    }
    if (!signatureInkDetected) return 'Draw your mouse signature in the signature box above.';
    return '';
  }, [
    confirmBusy,
    capturing,
    releaseAuthorized,
    fullNameMatches,
    enforceFullNameMatch,
    expectedFullName,
    signatureInkDetected
  ]);

  const canSubmit = !submitBlockReason;

  const getSignaturePanelColors = useCallback((panelEl) => {
    const el = panelEl || signaturePanelRef.current;
    if (typeof document !== 'undefined' && el) {
      const styles = getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color
      };
    }
    return {
      backgroundColor: CONSENT_SURFACE_YELLOW,
      color: CONSENT_SURFACE_TEXT
    };
  }, []);

  const paintSignatureCanvasBackground = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const { backgroundColor } = getSignaturePanelColors(signaturePanelRef.current);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundColor) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [getSignaturePanelColors]);

  useEffect(() => {
    if (open) {
      setReleaseAuthorized(false);
      const prefilledName =
        enforceFullNameMatch && String(expectedFullName ?? '').trim() ? String(expectedFullName).trim() : '';
      setFullNameSigned(prefilledName);
      setSignatureInkDetected(false);
      const paintAfterLayout = () => {
        paintSignatureCanvasBackground();
        setSignatureInkDetected(false);
      };
      window.requestAnimationFrame(paintAfterLayout);
      window.setTimeout(paintAfterLayout, 0);
    }
  }, [open, paintSignatureCanvasBackground, enforceFullNameMatch, expectedFullName]);

  useEffect(() => {
    if (!open || !scrollToBottomOnOpen) return undefined;

    let cancelled = false;
    const scrollToConsentActions = () => {
      if (cancelled) return;
      const panel = captureRef.current;
      const actions = submitActionsRef.current;
      if (actions) {
        actions.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (panel) {
        panel.scrollTop = panel.scrollHeight;
      }
    };

    const t0 = window.requestAnimationFrame(scrollToConsentActions);
    const t1 = window.setTimeout(scrollToConsentActions, 120);
    const t2 = window.setTimeout(scrollToConsentActions, 320);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, scrollToBottomOnOpen]);

  const getSignaturePoint = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const prepareSignatureContext = (context) => {
    const { color } = getSignaturePanelColors(signaturePanelRef.current);
    context.strokeStyle = color;
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  };

  const handleSignaturePointerDown = (event) => {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getSignaturePoint(event);
    if (!canvas || !context || !point) return;
    canvas.setPointerCapture?.(event.pointerId);
    prepareSignatureContext(context);
    context.beginPath();
    context.moveTo(point.x, point.y);
    signatureDrawingRef.current = true;
  };

  const handleSignaturePointerMove = (event) => {
    if (!signatureDrawingRef.current) return;
    event.preventDefault();
    const context = signatureCanvasRef.current?.getContext('2d');
    const point = getSignaturePoint(event);
    if (!context || !point) return;
    prepareSignatureContext(context);
    context.lineTo(point.x, point.y);
    context.stroke();
    refreshSignatureInk();
  };

  const stopSignatureDrawing = (event) => {
    signatureDrawingRef.current = false;
    signatureCanvasRef.current?.releasePointerCapture?.(event.pointerId);
    refreshSignatureInk();
  };

  const clearSignature = () => {
    paintSignatureCanvasBackground();
    setSignatureInkDetected(false);
  };

  const handleSubmit = async () => {
    refreshSignatureInk();
    const trimmedName = String(fullNameSigned).trim();
    const hasSignature = canvasHasSignatureInk(signatureCanvasRef.current);
    if (!trimmedName || !releaseAuthorized || !fullNameMatches || confirmBusy || capturing || !hasSignature) return;

    setCapturing(true);
    let consentSignatureImage = null;
    try {
      consentSignatureImage = await captureConsentDialogImage(captureRef.current);
    } catch (err) {
      console.warn('[VerificationAuthorizationDialog] consent capture failed', err?.message || err);
      await themedAlert('Failed to capture consent screen image. Please try again.');
      return;
    } finally {
      setCapturing(false);
    }

    onConfirm?.({
      fullNameSigned: trimmedName,
      viewerApprovedId: Number(viewerApprovedId),
      dateSigned: dateSigned || new Date().toISOString(),
      consentSignatureImage
    });
  };

  return (
    <ColorTemplate7PopupLargeDark open={open} showCloseButton={false}>
      <Box ref={captureRef} className="consent-dialog-capture-root">
        <ColorTemplate7PopupLargeDark.Body>
          <ColorTemplate7PopupLargeDark.Title>
            Self-Report authorization &amp; disclosure consent
          </ColorTemplate7PopupLargeDark.Title>
        <Box className="consent-disclaimer-body">
          <ConsentDisclaimerBody approvedViewingDurationMonths={approvedViewingDurationMonths} />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={releaseAuthorized}
              onChange={(event) => setReleaseAuthorized(event.target.checked)}
              icon={<ConsentCheckboxIcon checked={false} />}
              checkedIcon={<ConsentCheckboxIcon checked />}
              sx={{
                p: 1,
                '&:hover': { bgcolor: 'transparent' }
              }}
            />
          }
          label={getConsentCheckboxLabel()}
          sx={{ alignItems: 'flex-start', '.MuiFormControlLabel-label': { mt: 0.75 } }}
        />
        <Stack spacing={1.25} sx={{ mt: 1.5, width: '100%', alignSelf: 'stretch' }}>
          <Box sx={consentFieldRowSx}>
            <Typography sx={consentFieldLabelSx}>
              Type full name
            </Typography>
            <Box sx={{ ...consentFieldValueSx, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                fullWidth
                value={fullNameSigned}
                onChange={(event) => setFullNameSigned(event.target.value)}
                placeholder={fullNamePlaceholder}
                sx={consentFullNameFieldSx}
              />
              {showNameMatch ? (
                <Box component="span" role="status" sx={consentNameMatchLabelSx}>
                  <CheckIcon sx={consentNameMatchCheckSx} aria-hidden />
                  <Box component="span" sx={consentNameMatchTextSx}>
                    Full Name Match
                  </Box>
                </Box>
              ) : showNameMismatch ? (
                <Typography component="span" role="status" sx={consentNameMismatchLabelSx}>
                  Name not match
                </Typography>
              ) : null}
            </Box>
          </Box>
          {showViewerApproved ? (
            <Box sx={consentFieldRowSx}>
              <Typography sx={consentFieldLabelSx}>
                Viewer Approved
              </Typography>
              <TextField size="small" fullWidth disabled value={viewerApprovedLabel} sx={{ ...consentFieldValueSx, ...disabledConsentFieldSx }} />
            </Box>
          ) : null}
          <Box sx={consentFieldRowSx}>
            <Typography sx={consentFieldLabelSx}>
              Date
            </Typography>
            <TextField size="small" fullWidth disabled value={resolvedDateSigned} sx={{ ...consentFieldValueSx, ...disabledConsentFieldSx }} />
          </Box>
          <Box sx={{ ...consentFieldRowSx, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
            <Typography sx={{ ...consentFieldLabelSx, pt: { sm: 1 } }}>
              Mouse signature
            </Typography>
            <Box
              sx={{
                ...consentFieldValueSx,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: { xs: 'wrap', sm: 'nowrap' }
              }}
            >
              <Box
                ref={signaturePanelRef}
                className="consent-signature-capture-surface"
                sx={{ ...consentSignaturePanelSx, flex: 1, minWidth: 0 }}
              >
                <Box
                  component="canvas"
                  ref={signatureCanvasRef}
                  width={900}
                  height={150}
                  aria-label="Mouse signature area"
                  onPointerDown={handleSignaturePointerDown}
                  onPointerMove={handleSignaturePointerMove}
                  onPointerUp={stopSignatureDrawing}
                  onPointerLeave={stopSignatureDrawing}
                  onPointerCancel={stopSignatureDrawing}
                  sx={{
                    width: '100%',
                    height: { xs: 96, sm: 110 },
                    display: 'block',
                    cursor: 'crosshair',
                    touchAction: 'none',
                    bgcolor: 'transparent'
                  }}
                />
                <Typography className="consent-surface-text" sx={consentSignatureCaptionSx}>
                  {signatureCaption}
                </Typography>
              </Box>
              <UnSelectedButtonTemplate
                type="button"
                className="consent-surface-button"
                disableElevation
                disableRipple
                hoverScale={1}
                disabled={confirmBusy || capturing || !signatureInkDetected}
                onClick={clearSignature}
                sx={{ flexShrink: 0 }}
              >
                Clear
              </UnSelectedButtonTemplate>
              <UnSelectedButtonTemplate
                type="button"
                className="consent-surface-button"
                disableElevation
                disableRipple
                hoverScale={1}
                disabled={confirmBusy || capturing}
                onClick={onCancel}
                sx={{ flexShrink: 0, ml: { xs: 0, sm: 'auto' } }}
              >
                Cancel
              </UnSelectedButtonTemplate>
            </Box>
          </Box>
        </Stack>
        <Box
          ref={submitActionsRef}
          sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mt: 1.5 }}
        >
          {!canSubmit && submitBlockReason ? (
            <Typography
              role="status"
              sx={{
                width: '100%',
                textAlign: 'center',
                color: '#e53935',
                fontWeight: 700,
                fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() }
              }}
            >
              {submitBlockReason}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <ColorTemplate7PopupLargeDark.ActionButton disabled={!canSubmit} onClick={() => void handleSubmit()}>
              {confirmBusy ? 'Saving...' : capturing ? 'Capturing...' : 'Submit Consent'}
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Box>
        </Box>
        </ColorTemplate7PopupLargeDark.Body>
      </Box>
    </ColorTemplate7PopupLargeDark>
  );
}
