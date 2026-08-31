import PropTypes from 'prop-types';
import { useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import {
  COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
  COLOR_TEMPLATE7_POPUP_INPUT_TEXT,
  COLOR_TEMPLATE7_POPUP_TEXT,
  colorTemplate7PopupCheckboxShellSx,
  colorTemplate7PopupTextFontSizeResponsive
} from 'config/colorTemplate7PopupLargeDark';
import { BUTTON_TEMPLATE_THICK_BLACK_BORDER } from 'config/selectedUnselectedButtonTemplate';
import {
  REQUIRED_LABEL_TEXT_SHADOW,
  REQUIRED_LABEL_TEXT_STROKE,
  REQUIRED_LABEL_HIGHLIGHT_YELLOW,
  requiredLabelSuffixSx,
  requiredLabelSuffixYellowSx
} from 'config/requiredLabelSuffix';
import useRequiredLabelSuffixSx from 'hooks/useRequiredLabelSuffixSx';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import Button from '@mui/material/Button';
import IdentificationVerificationUploadDialog from './IdentificationVerificationUploadDialog';
import LiveFaceScanVideoFallback from './LiveFaceScanVideoFallback';

/** All Identification Verification action buttons use a thick black border. */
export const IDV_BUTTON_THICK_BLACK_BORDER = true;

/** Fixed green (#60C446) — not theme `--theme-action-green-color` (minimal palette = panel red). */
export const idvActionButtonSx = {
  height: 'auto',
  minHeight: { xs: 48, sm: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT },
  whiteSpace: 'normal',
  lineHeight: 1.25,
  px: { xs: 2.25, sm: 3 },
  py: { xs: 0.85, sm: 1 },
  fontWeight: 700
};

export function IdvActionButton({ sx, children, ...rest }) {
  return (
    <ColorTemplate7PopupLargeDark.ActionButton
      thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
      sx={{ ...idvActionButtonSx, ...(sx || {}) }}
      {...rest}
    >
      {children}
    </ColorTemplate7PopupLargeDark.ActionButton>
  );
}

IdvActionButton.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};

export { IdvBusyHourglass } from 'ui-component/BusyHourglass';

function scaleVwFontSize(vwSize, multiplier) {
  const match = /^([\d.]+)vw$/.exec(String(vwSize ?? '').trim());
  if (!match) return `${2 * multiplier}vw`;
  return `${Math.min(Number(match[1]) * multiplier, 25)}vw`;
}

/** Step 5 live scan dashed-frame copy — 4× DESKTOP_FONT_SIZE_TEXT. */
const LIVE_SCAN_STEP_INSTRUCTION_FONT_SIZE = scaleVwFontSize(getDesktopTextFontSizeVw(), 4);

const liveScanStepInstructionBodySx = {
  textAlign: 'center',
  fontWeight: 700,
  fontSize: LIVE_SCAN_STEP_INSTRUCTION_FONT_SIZE,
  lineHeight: 1.25,
  px: 0.5
};

const optionalLabelSuffixSx = requiredLabelSuffixSx;

export function RequiredLabelSuffix({ forceYellow = true }) {
  const themeSx = useRequiredLabelSuffixSx();
  const suffixSx = forceYellow ? requiredLabelSuffixYellowSx : themeSx;
  return (
    <Box component="span" className="required-label-suffix" sx={suffixSx}>
      {' '}
      (Required)
    </Box>
  );
}

export function OptionalLabelSuffix() {
  return (
    <Box component="span" sx={optionalLabelSuffixSx}>
      {' '}
      (Optional)
    </Box>
  );
}

export function withRequiredLabelSuffix(label) {
  return (
    <>
      {label}
      <RequiredLabelSuffix />
    </>
  );
}

const MANUAL_SUPPORT_LABEL = 'Marked for manual Process by Support';

const IDV_GREEN_CHECKBOX_GREEN = '#43a047';
const IDV_GREEN_CHECKBOX_GREEN_BORDER = '#2e7d32';

function IdVerificationGreenCheckboxIcon({ checked = false }) {
  return (
    <Box
      sx={{
        ...colorTemplate7PopupCheckboxShellSx(),
        ...(checked
          ? {
              bgcolor: `${IDV_GREEN_CHECKBOX_GREEN} !important`,
              border: `3px solid ${IDV_GREEN_CHECKBOX_GREEN_BORDER} !important`
            }
          : {})
      }}
    >
      {checked ? <CheckIcon sx={{ color: '#ffffff', width: '70%', height: '70%' }} aria-hidden /> : null}
    </Box>
  );
}

IdVerificationGreenCheckboxIcon.propTypes = {
  checked: PropTypes.bool
};

const slotColumnSx = {
  flex: 1,
  minWidth: { xs: '100%', sm: 0 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1
};

const slotImageBoxSx = {
  width: '100%',
  maxWidth: 200,
  minHeight: 140,
  border: '3px dashed var(--theme-primary-color)',
  borderRadius: 1,
  bgcolor: 'rgba(25, 118, 210, 0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 1,
  boxSizing: 'border-box'
};

const slotPreviewImgSx = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: 130,
  objectFit: 'contain',
  borderRadius: 0.5
};

const matchReadoutSx = {
  fontWeight: 700,
  color: COLOR_TEMPLATE7_POPUP_TEXT,
  WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
  fontSize: colorTemplate7PopupTextFontSizeResponsive,
  lineHeight: 1.4,
  textAlign: 'center',
  width: '100%'
};

const MATCH_READOUT_FAIL_COLOR = '#d32f2f';
const MATCH_READOUT_FAIL_TEXT_STROKE = '2px #000000';

const matchReadoutFailSx = {
  ...matchReadoutSx,
  color: MATCH_READOUT_FAIL_COLOR,
  WebkitTextFillColor: MATCH_READOUT_FAIL_COLOR,
  WebkitTextStroke: MATCH_READOUT_FAIL_TEXT_STROKE,
  paintOrder: 'stroke fill'
};

/** Fixed yellow + black text stroke — not theme `--theme-yellow-color` (minimal palette ≠ #FFEB3B on red panel). */
const idvYellowStrokeTextSx = {
  color: `${REQUIRED_LABEL_HIGHLIGHT_YELLOW} !important`,
  WebkitTextFillColor: `${REQUIRED_LABEL_HIGHLIGHT_YELLOW} !important`,
  WebkitTextStroke: REQUIRED_LABEL_TEXT_STROKE,
  textShadow: REQUIRED_LABEL_TEXT_SHADOW,
  paintOrder: 'stroke fill'
};

const matchPctFailSx = {
  color: `${MATCH_READOUT_FAIL_COLOR} !important`,
  WebkitTextFillColor: `${MATCH_READOUT_FAIL_COLOR} !important`,
  WebkitTextStroke: `${MATCH_READOUT_FAIL_TEXT_STROKE} !important`,
  paintOrder: 'stroke fill'
};

const matchPctPassSx = {
  ...idvYellowStrokeTextSx,
  fontWeight: 700
};

function MatchPctReadout({ pct, passed = true }) {
  if (!passed) {
    return (
      <Box component="span" sx={matchPctFailSx}>
        {pct}%
      </Box>
    );
  }
  return (
    <Box component="span" sx={matchPctPassSx}>
      {pct}%
    </Box>
  );
}

MatchPctReadout.propTypes = {
  pct: PropTypes.number.isRequired,
  passed: PropTypes.bool
};

/** Below threshold: red text + thick black stroke, exactly 2 lines (label+pct, then Not Match). */
function MatchReadoutFailTwoLines({ sx, line1, line2 = 'Not Match' }) {
  const lineSx = { ...matchReadoutFailSx, display: 'block', width: '100%', ...sx };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <Box component="span" sx={lineSx}>
        {line1}
      </Box>
      <Box component="span" sx={lineSx}>
        {line2}
      </Box>
    </Box>
  );
}

MatchReadoutFailTwoLines.propTypes = {
  sx: PropTypes.object,
  line1: PropTypes.node.isRequired,
  line2: PropTypes.string
};

const extractedGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: 'max-content 1fr', sm: '120px 1fr' },
  gap: 0.75,
  rowGap: 0.5,
  width: '100%',
  maxWidth: 420,
  mx: 'auto',
  mt: 1
};

const extractedGridInColumnSx = {
  ...extractedGridSx,
  maxWidth: '100%',
  mx: 0,
  gridTemplateColumns: { xs: 'max-content 1fr', sm: 'max-content 1fr' }
};

const slotVerifyErrorTextSx = {
  fontWeight: 700,
  color: COLOR_TEMPLATE7_POPUP_TEXT,
  WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
  fontSize: colorTemplate7PopupTextFontSizeResponsive,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  textAlign: 'center',
  lineHeight: 1.35
};

const govIdSlotColumnSx = {
  ...slotColumnSx,
  minWidth: { xs: '100%', sm: 280 }
};

function SlotErrorBlock({ errorText, manualSupportChecked, onManualSupportChange }) {
  if (!errorText) return null;
  return (
    <Stack spacing={0.75} sx={{ width: '100%', maxWidth: 220, px: 0.5 }}>
      <Box sx={slotVerifyErrorTextSx}>
        {errorText}
      </Box>
      <FormControlLabel
        sx={{
          alignItems: 'flex-start',
          m: 0,
          '& .MuiFormControlLabel-label': {
            color: `${COLOR_TEMPLATE7_POPUP_TEXT} !important`,
            fontSize: '0.72rem',
            lineHeight: 1.3,
            pt: 0.5
          }
        }}
        control={
          <ColorTemplate7PopupLargeDark.Checkbox
            checked={Boolean(manualSupportChecked)}
            onChange={(e) => onManualSupportChange?.(e.target.checked)}
            icon={<IdVerificationGreenCheckboxIcon checked={false} />}
            checkedIcon={<IdVerificationGreenCheckboxIcon checked />}
            sx={{ py: 0.25 }}
          />
        }
        label={MANUAL_SUPPORT_LABEL}
      />
    </Stack>
  );
}

SlotErrorBlock.propTypes = {
  errorText: PropTypes.string,
  manualSupportChecked: PropTypes.bool,
  onManualSupportChange: PropTypes.func
};

function MatchReadout({
  verified,
  matchPct,
  matchThreshold = 90,
  showWhenPctOnly = false,
  variant = 'default',
  sx: sxOverride
}) {
  const threshold = Number.isFinite(Number(matchThreshold)) ? Number(matchThreshold) : 90;
  const readoutSx = { ...matchReadoutSx, ...(sxOverride || {}) };
  const failSx = { ...matchReadoutFailSx, ...(sxOverride || {}) };
  if (variant === 'liveScanProfile' && matchPct == null) {
    if (!showWhenPctOnly && !verified) return null;
    return (
      <Box sx={readoutSx}>
        Match between LiveScan & Profile Photo: N/A
      </Box>
    );
  }
  if (matchPct == null) return null;
  if (!showWhenPctOnly && !verified) return null;
  const pct = Math.round(matchPct);
  const passed = pct >= threshold;
  if (variant === 'liveScanProfile') {
    const passHint = `(>=${threshold}% is pass)`;
    if (!passed) {
      return (
        <MatchReadoutFailTwoLines
          sx={failSx}
          line1={
            <>
              Match between LiveScan & Profile Photo: <MatchPctReadout pct={pct} passed={false} />
            </>
          }
          line2={`Not Match ${passHint}`}
        />
      );
    }
    return (
      <Box sx={readoutSx}>
        Match between LiveScan & Profile Photo:{' '}
        <Box component="span" sx={matchPctPassSx}>
          Pass at {pct}% match
        </Box>{' '}
        {passHint}
      </Box>
    );
  }
  if (variant === 'profileDl') {
    if (!passed) {
      return (
        <MatchReadoutFailTwoLines
          sx={failSx}
          line1={
            <>
              Match between Profile & Driver Licence: <MatchPctReadout pct={pct} passed={false} />
            </>
          }
        />
      );
    }
    return (
      <Box sx={readoutSx}>
        Match between Profile & Driver Licence: <MatchPctReadout pct={pct} />
      </Box>
    );
  }
  if (variant === 'dlProfile') {
    if (!passed) {
      return (
        <MatchReadoutFailTwoLines
          sx={failSx}
          line1={
            <>
              Match between Driver Licence & Profile: <MatchPctReadout pct={pct} passed={false} />
            </>
          }
        />
      );
    }
    return (
      <Box sx={readoutSx}>
        Match between Driver Licence & Profile: <MatchPctReadout pct={pct} />
      </Box>
    );
  }
  if (variant === 'ppProfile') {
    if (!passed) {
      return (
        <MatchReadoutFailTwoLines
          sx={failSx}
          line1={
            <>
              Match between Passport & Profile: <MatchPctReadout pct={pct} passed={false} />
            </>
          }
        />
      );
    }
    return (
      <Box sx={readoutSx}>
        Match between Passport & Profile: <MatchPctReadout pct={pct} />
      </Box>
    );
  }
  if (!passed) {
    return (
      <MatchReadoutFailTwoLines
        sx={failSx}
        line1={<MatchPctReadout pct={pct} passed={false} />}
      />
    );
  }
  return (
    <Box sx={readoutSx}>
      Match <MatchPctReadout pct={pct} />
    </Box>
  );
}

MatchReadout.propTypes = {
  verified: PropTypes.bool,
  matchPct: PropTypes.number,
  matchThreshold: PropTypes.number,
  showWhenPctOnly: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'liveScanProfile', 'profileDl', 'dlProfile', 'ppProfile']),
  sx: PropTypes.object
};

function VerificationSlot({
  title,
  slotReady,
  columnSx,
  children,
  actionBetweenFrameAndVerify,
  verifyLabel,
  verifyDoneLabel = 'Verify Done',
  lockAfterVerified = true,
  keepVerifyButtonWhenVerified = false,
  verifyLabelSingleLine = false,
  verifyButtonSx,
  onVerify,
  verifyDisabled,
  verifying,
  verified,
  matchPct,
  matchThreshold,
  showMatchWhenPct = false,
  matchReadoutVariant = 'default',
  hideVerifyButton = false,
  slotProcessingLabel,
  optional = false,
  centerSlotOnPage = false,
  dimSlotPreview = false,
  failLabel,
  manualSupportChecked,
  onManualSupportChange,
  footer,
  imageBoxSx: imageBoxSxOverride,
  instructionFontSize,
  matchReadoutFontSize,
  verifyBypassAction = null
}) {
  const slotError =
    failLabel && (!verified || keepVerifyButtonWhenVerified) ? failLabel : null;
  const showVerifyDoneOnly = verified && lockAfterVerified && !verifying && !keepVerifyButtonWhenVerified;
  const showVerifyDoneWithRescan =
    verified && lockAfterVerified && !verifying && keepVerifyButtonWhenVerified;
  const defaultImageBoxSx = centerSlotOnPage ? wizardSlotImageBoxSx : slotImageBoxSx;
  const resolvedImageBoxSx = imageBoxSxOverride || defaultImageBoxSx;
  const instructionTextSx = instructionFontSize ? { fontSize: instructionFontSize, lineHeight: 1.25 } : null;
  const matchReadoutSxOverride = matchReadoutFontSize ? { fontSize: matchReadoutFontSize, lineHeight: 1.25 } : null;

  return (
    <Box sx={{ ...slotColumnSx, ...(columnSx || {}) }}>
      <BusyHourglassOverlay
        open={Boolean(verifying)}
        label={slotProcessingLabel || 'Verifying'}
      />
      <ColorTemplate7PopupLargeDark.SectionLabel
        sx={{ fontWeight: 700, textAlign: 'center', width: '100%', ...instructionTextSx }}
      >
        {title}
        {optional ? <OptionalLabelSuffix /> : <RequiredLabelSuffix />}
      </ColorTemplate7PopupLargeDark.SectionLabel>
      <Box
        sx={{
          ...resolvedImageBoxSx,
          position: 'relative',
          opacity: slotReady ? 1 : 0.75,
          ...(dimSlotPreview ? wizardSlotDimmedPreviewSx : null)
        }}
      >
        {children}
        {verifying ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              bgcolor: 'rgba(0,0,0,0.35)',
              px: 1
            }}
            role="status"
            aria-live="polite"
          >
            {slotProcessingLabel ? (
              <ColorTemplate7PopupLargeDark.BodyText
                sx={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, ...instructionTextSx }}
              >
                {slotProcessingLabel}
              </ColorTemplate7PopupLargeDark.BodyText>
            ) : null}
          </Box>
        ) : null}
      </Box>
      {actionBetweenFrameAndVerify ? (
        centerSlotOnPage ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>{actionBetweenFrameAndVerify}</Box>
        ) : (
          actionBetweenFrameAndVerify
        )
      ) : null}
      {!hideVerifyButton ? (
        <Stack spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
          {!showVerifyDoneOnly ? (
            <ColorTemplate7PopupLargeDark.ActionButton
              thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
              onClick={onVerify}
              disabled={verifyDisabled || verifying}
              sx={{
                ...idvActionButtonSx,
                minWidth: 140,
                ...(verifyLabelSingleLine
                  ? { whiteSpace: 'nowrap', lineHeight: 1.2 }
                  : null),
                ...(verifyButtonSx || {})
              }}
            >
              {verifying ? 'Verifying…' : verifyLabel}
            </ColorTemplate7PopupLargeDark.ActionButton>
          ) : null}
          {showVerifyDoneOnly || showVerifyDoneWithRescan ? (
            <Box
              component="p"
              role="status"
              sx={{ ...idvVerifyDoneLabelSx, ...(verifyButtonSx || {}) }}
            >
              {verifyDoneLabel}
            </Box>
          ) : null}
          {verifyBypassAction}
        </Stack>
      ) : null}
      {slotError ? (
        <Box sx={centerSlotOnPage ? { width: '100%', display: 'flex', justifyContent: 'center' } : undefined}>
          <SlotErrorBlock
            errorText={slotError}
            manualSupportChecked={manualSupportChecked}
            onManualSupportChange={onManualSupportChange}
          />
        </Box>
      ) : (
        <MatchReadout
          verified={verified}
          matchPct={matchPct}
          matchThreshold={matchThreshold}
          showWhenPctOnly={showMatchWhenPct}
          variant={matchReadoutVariant}
          sx={matchReadoutSxOverride}
        />
      )}
      {footer ? <Box sx={{ width: '100%', alignSelf: 'stretch' }}>{footer}</Box> : null}
    </Box>
  );
}

VerificationSlot.propTypes = {
  title: PropTypes.string.isRequired,
  slotReady: PropTypes.bool,
  columnSx: PropTypes.object,
  children: PropTypes.node,
  actionBetweenFrameAndVerify: PropTypes.node,
  verifyLabel: PropTypes.string.isRequired,
  verifyDoneLabel: PropTypes.string,
  lockAfterVerified: PropTypes.bool,
  keepVerifyButtonWhenVerified: PropTypes.bool,
  verifyLabelSingleLine: PropTypes.bool,
  verifyButtonSx: PropTypes.object,
  onVerify: PropTypes.func,
  verifyDisabled: PropTypes.bool,
  verifying: PropTypes.bool,
  verified: PropTypes.bool,
  matchPct: PropTypes.number,
  matchThreshold: PropTypes.number,
  showMatchWhenPct: PropTypes.bool,
  matchReadoutVariant: PropTypes.oneOf(['default', 'liveScanProfile', 'profileDl', 'dlProfile', 'ppProfile']),
  hideVerifyButton: PropTypes.bool,
  slotProcessingLabel: PropTypes.string,
  optional: PropTypes.bool,
  centerSlotOnPage: PropTypes.bool,
  dimSlotPreview: PropTypes.bool,
  failLabel: PropTypes.string,
  manualSupportChecked: PropTypes.bool,
  onManualSupportChange: PropTypes.func,
  footer: PropTypes.node,
  imageBoxSx: PropTypes.object,
  instructionFontSize: PropTypes.string,
  matchReadoutFontSize: PropTypes.string
};

function GovIdFrameContent({ preview }) {
  if (preview) {
    return <Box component="img" src={preview} alt="Government ID preview" sx={slotPreviewImgSx} />;
  }
  return null;
}

GovIdFrameContent.propTypes = {
  preview: PropTypes.string
};

function GovIdUploadActions({
  adminImpersonationBypass = false,
  uploadLabel,
  bypassLabel,
  onUpload,
  onBypass,
  disabled = false
}) {
  if (!adminImpersonationBypass) {
    return (
      <IdvActionButton onClick={onUpload} disabled={disabled}>
        {uploadLabel}
      </IdvActionButton>
    );
  }
  return (
    <Stack
      direction="column"
      spacing={1.25}
      alignItems="stretch"
      justifyContent="center"
      sx={{ width: '100%', maxWidth: 320, mx: 'auto' }}
    >
      <IdvActionButton onClick={onUpload} disabled={disabled}>
        {uploadLabel}
      </IdvActionButton>
      <Button
        variant="contained"
        disableElevation
        disabled={disabled}
        onClick={onBypass}
        sx={{ ...adminImpersonationBypassButtonSx, width: '100%' }}
      >
        {bypassLabel}
      </Button>
    </Stack>
  );
}

GovIdUploadActions.propTypes = {
  adminImpersonationBypass: PropTypes.bool,
  uploadLabel: PropTypes.string.isRequired,
  bypassLabel: PropTypes.string.isRequired,
  onUpload: PropTypes.func,
  onBypass: PropTypes.func,
  disabled: PropTypes.bool
};

function GovIdUploadButton({ uploadButtonLabel, onUploadClick, disabled = false, adminBypass = false }) {
  if (adminBypass) {
    return (
      <Button
        variant="contained"
        disableElevation
        disabled={disabled}
        onClick={onUploadClick}
        sx={adminImpersonationBypassButtonSx}
      >
        {uploadButtonLabel}
      </Button>
    );
  }
  return (
    <IdvActionButton onClick={onUploadClick} disabled={disabled}>
      {uploadButtonLabel}
    </IdvActionButton>
  );
}

GovIdUploadButton.propTypes = {
  uploadButtonLabel: PropTypes.string.isRequired,
  onUploadClick: PropTypes.func,
  disabled: PropTypes.bool,
  adminBypass: PropTypes.bool
};

function formatExtractedName(extracted) {
  if (!extracted) return '—';
  const parts = [extracted.lastName, extracted.firstName, extracted.middleName || extracted.middleInitial].filter(Boolean);
  if (parts.length >= 2 && extracted.lastName) {
    return `${extracted.lastName}, ${[extracted.firstName, extracted.middleName || extracted.middleInitial].filter(Boolean).join(' ')}`;
  }
  return [extracted.firstName, extracted.middleInitial, extracted.lastName].filter(Boolean).join(' ') || '—';
}

function formatSexDisplay(sex) {
  if (!sex) return '—';
  if (sex === 'M') return 'M';
  if (sex === 'F') return 'F';
  return String(sex);
}

/** Yellow text + black stroke — shown beside DOB when age ≥ 18. */
function VerifiedOver18AgeLabel() {
  return (
    <Box
      component="span"
      className="required-label-suffix"
      sx={{
        color: `${REQUIRED_LABEL_HIGHLIGHT_YELLOW} !important`,
        WebkitTextFillColor: `${REQUIRED_LABEL_HIGHLIGHT_YELLOW} !important`,
        fontWeight: 700,
        WebkitTextStroke: REQUIRED_LABEL_TEXT_STROKE,
        textShadow: REQUIRED_LABEL_TEXT_SHADOW,
        paintOrder: 'stroke fill'
      }}
    >
      (Verified over 18 age)
    </Box>
  );
}

function DobWithOver18Badge({ dateOfBirth, age }) {
  const showVerifiedLabel = Number.isFinite(age) && age >= 18;
  const dobText = dateOfBirth || '—';
  return (
    <ColorTemplate7PopupLargeDark.BodyText sx={{ mb: 0 }}>
      {dobText}
      {showVerifiedLabel ? (
        <>
          {' '}
          <VerifiedOver18AgeLabel />
        </>
      ) : null}
    </ColorTemplate7PopupLargeDark.BodyText>
  );
}

function ExtractedFieldsPanel({ title, extracted, showPassportLabels, inColumn = false }) {
  if (!extracted) return null;
  return (
    <Box
      sx={{
        width: '100%',
        alignSelf: 'stretch',
        borderTop: '2px solid var(--theme-primary-color)',
        pt: inColumn ? 1.25 : 2,
        mt: inColumn ? 1 : 2
      }}
    >
      <ColorTemplate7PopupLargeDark.SectionTitle sx={{ textAlign: 'center', mt: 0, fontSize: inColumn ? colorTemplate7PopupTextFontSizeResponsive : undefined }}>
        {title}
      </ColorTemplate7PopupLargeDark.SectionTitle>
      <Box sx={inColumn ? extractedGridInColumnSx : extractedGridSx}>
        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Document</ColorTemplate7PopupLargeDark.SectionLabel>
        <ColorTemplate7PopupLargeDark.BodyText>
          {extracted.documentType === 'passport'
            ? 'Passport'
            : extracted.documentType === 'driver_license'
              ? 'Driver License'
              : extracted.documentType || '—'}
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Name</ColorTemplate7PopupLargeDark.SectionLabel>
        <ColorTemplate7PopupLargeDark.BodyText>{formatExtractedName(extracted)}</ColorTemplate7PopupLargeDark.BodyText>
        {extracted.documentType === 'passport' ? (
          <>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Age</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>
              {extracted.age != null ? extracted.age : '—'}
            </ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Sex</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>{formatSexDisplay(extracted.sex)}</ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Date of birth</ColorTemplate7PopupLargeDark.SectionLabel>
            <DobWithOver18Badge dateOfBirth={extracted.dateOfBirth} age={extracted.age} />
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Place of Birth</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>
              {extracted.countryOfBirth || extracted.placeOfBirth || '—'}
            </ColorTemplate7PopupLargeDark.BodyText>
          </>
        ) : extracted.documentType !== 'passport' ? (
          <>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Age</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>
              {extracted.age != null ? extracted.age : '—'}
            </ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Sex</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>{formatSexDisplay(extracted.sex)}</ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Date of birth</ColorTemplate7PopupLargeDark.SectionLabel>
            <DobWithOver18Badge dateOfBirth={extracted.dateOfBirth} age={extracted.age} />
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Height</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>{extracted.height || '—'}</ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>City</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>{extracted.city || '—'}</ColorTemplate7PopupLargeDark.BodyText>
          </>
        ) : null}
        {(extracted.ppNationality || extracted.nationality) ? (
          <>
            <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700 }}>Nationality</ColorTemplate7PopupLargeDark.SectionLabel>
            <ColorTemplate7PopupLargeDark.BodyText>
              {[extracted.ppNationality, extracted.nationality].filter(Boolean).join(' · ')}
            </ColorTemplate7PopupLargeDark.BodyText>
          </>
        ) : null}
      </Box>
      {showPassportLabels && extracted.passportLabelsFound?.length ? (
        <ColorTemplate7PopupLargeDark.BodyText sx={{ mt: 1.5, textAlign: 'center', fontSize: '0.85rem' }}>
          Labels found: {extracted.passportLabelsFound.join(', ')}
        </ColorTemplate7PopupLargeDark.BodyText>
      ) : null}
    </Box>
  );
}

ExtractedFieldsPanel.propTypes = {
  title: PropTypes.string.isRequired,
  extracted: PropTypes.object,
  showPassportLabels: PropTypes.bool,
  inColumn: PropTypes.bool
};

const verificationRowGapSx = {
  mt: { xs: 3, sm: 3.5 },
  pt: { xs: 2, sm: 2.5 },
  borderTop: 'none'
};

const liveFaceVerifyButtonSx = {
  ...idvActionButtonSx,
  minHeight: { xs: 56, sm: 60 },
  py: { xs: 1, sm: 1.15 }
};

/** Yellow label + black text stroke — replaces green button after live scan verifies. */
const idvVerifyDoneLabelSx = {
  ...idvYellowStrokeTextSx,
  fontWeight: 700,
  fontSize: buttonFontSizeResponsive,
  lineHeight: 1.2,
  textAlign: 'center',
  width: '100%',
  maxWidth: 320,
  minHeight: { xs: 56, sm: 60 },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: { xs: 2.75, sm: 3.25 }
};

/** Orange admin-impersonation bypass (DL / passport upload + live scan). */
export const adminImpersonationBypassButtonSx = {
  bgcolor: '#ff9800 !important',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`,
  boxShadow: 'none !important',
  borderRadius: 999,
  textTransform: 'none',
  whiteSpace: 'normal',
  lineHeight: 1.25,
  minHeight: { xs: 56, sm: 60 },
  minWidth: 140,
  py: { xs: 1, sm: 1.15 },
  px: { xs: 2.75, sm: 3.25 },
  fontWeight: 700,
  '&:hover': {
    bgcolor: '#fb8c00 !important',
    boxShadow: 'none !important',
    border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`
  },
  '&:disabled': {
    bgcolor: 'rgba(255, 152, 0, 0.45) !important',
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`
  }
};

const wizardStepHeadingSx = {
  fontWeight: 700,
  textAlign: 'center',
  width: '100%',
  mb: 0.5
};

const wizardStepStackSx = {
  width: '100%',
  alignItems: 'center'
};

const wizardStepColumnSx = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1
};

const wizardVerificationSlotColumnSx = {
  width: '100%',
  maxWidth: 280,
  mx: 'auto',
  flex: 'none',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1
};

const wizardGovIdSlotColumnSx = {
  ...wizardVerificationSlotColumnSx,
  maxWidth: 360
};

const wizardSlotDimmedPreviewSx = {
  opacity: 0.42,
  filter: 'grayscale(55%)'
};

const wizardExtractedFooterWrapSx = {
  width: '100%',
  maxWidth: 360,
  mx: 'auto'
};

const wizardSlotImageBoxSx = {
  ...slotImageBoxSx,
  mx: 'auto'
};

const liveScanStepSlotImageBoxSx = {
  ...wizardSlotImageBoxSx,
  maxWidth: 600,
  minHeight: 420,
  p: 3
};

const liveScanWizardColumnSx = {
  ...wizardVerificationSlotColumnSx,
  maxWidth: 840
};

function WizardStepHeading({ stepNumber, label }) {
  return (
    <ColorTemplate7PopupLargeDark.SectionTitle sx={wizardStepHeadingSx}>
      Step {stepNumber}: {label}
    </ColorTemplate7PopupLargeDark.SectionTitle>
  );
}

WizardStepHeading.propTypes = {
  stepNumber: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired
};

const WIZARD_STEP_PROFILE = 2;
const WIZARD_STEP_DRIVER_LICENSE = 3;
const WIZARD_STEP_PASSPORT = 4;
const WIZARD_STEP_LIVE_SCAN = 5;

export {
  WIZARD_STEP_PROFILE,
  WIZARD_STEP_DRIVER_LICENSE,
  WIZARD_STEP_PASSPORT,
  WIZARD_STEP_LIVE_SCAN
};

export default function IdentificationVerificationBoard({
  wizardStep,
  skipLiveFaceScan,
  adminImpersonationBypass = false,
  onBypassDriverLicense,
  onBypassPassport,
  onBypassLiveScan,
  liveFaceBypassDisabled = false,
  profilePhotoUrl,
  profileSlotReady,
  profilePhotoLoadFailed,
  onProfilePhotoLoad,
  onProfilePhotoError,
  profileVerifying,
  profileVerified,
  profileMatchPct,
  profileVerifyError,
  profileManualSupport,
  onProfileManualSupportChange,
  onVerifyProfile,
  onUploadFilePick,
  onUploadPhoneComplete,
  driverLicenseUserUploaded = false,
  driverLicensePreview,
  onDriverLicenseFilePick,
  driverLicenseSlotReady,
  driverLicenseVerifying,
  driverLicenseVerified,
  driverLicenseMatchPct,
  driverLicenseVerifyError,
  driverLicenseManualSupport,
  onDriverLicenseManualSupportChange,
  onVerifyDriverLicense,
  driverLicenseVerifyDisabled = true,
  driverLicenseExtracted,
  passportPreview,
  onPassportFilePick,
  passportSlotReady,
  passportVerifying,
  passportVerified,
  passportMatchPct,
  passportVerifyError,
  passportManualSupport,
  onPassportManualSupportChange,
  onVerifyPassport,
  passportVerifyDisabled = true,
  passportExtracted,
  livenessPassed,
  liveFaceSlotReady,
  liveFaceVerifying,
  liveFaceVerified,
  liveFaceMatchPct,
  liveFaceVerifyError,
  liveFaceSnapshotPreview,
  liveFaceVerifyDisabled,
  liveScanManualVideoFallback = false,
  liveScanRetryCountdownSec = 0,
  faceMatchThreshold = 90,
  onVerifyLiveFace,
  verifyButtonsEnabled,
  consentFullName = '',
  consentFirstName = '',
  viewerApprovedId = null,
  onLiveScanVideoSent,
  onLiveScanVideoRecorded,
  onLiveScanVideoCleared
}) {
  const [uploadDialogKind, setUploadDialogKind] = useState(null);

  const profileFail = profileVerifyError || (profilePhotoLoadFailed ? 'No profile photo' : null);
  const driverLicenseFail = driverLicenseVerifyError || null;
  const passportFail = passportVerifyError || null;
  const liveScanThreshold = Number.isFinite(Number(faceMatchThreshold)) ? Number(faceMatchThreshold) : 90;
  const liveScanMatchSatisfied =
    liveFaceMatchPct != null && Number(liveFaceMatchPct) >= liveScanThreshold;
  const liveScanFail =
    liveFaceVerifyError ||
    (liveFaceMatchPct != null && !liveScanMatchSatisfied
      ? `Live scan match ${Math.round(liveFaceMatchPct)}% is below ${liveScanThreshold}%. Click Live Scan to try again.`
      : null);

  const uploadDialog = (
    <IdentificationVerificationUploadDialog
      open={uploadDialogKind != null}
      kind={uploadDialogKind}
      onClose={() => setUploadDialogKind(null)}
      onDesktopFile={(file) => onUploadFilePick?.(uploadDialogKind, file)}
      onPhoneUploadComplete={(photosId, meta) => onUploadPhoneComplete?.(uploadDialogKind, photosId, meta)}
    />
  );

  if (wizardStep === WIZARD_STEP_PROFILE) {
    return (
      <Stack spacing={2} sx={wizardStepStackSx}>
        {uploadDialog}
        <WizardStepHeading stepNumber={2} label="Profile Photo" />
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', width: '100%' }}>
          Confirm your profile photo or upload a new one before continuing.  Once verified, you will not be able to change it for 30 days"
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={wizardStepColumnSx}>
          <VerificationSlot
            title="Profile Photo"
            columnSx={wizardVerificationSlotColumnSx}
            centerSlotOnPage
            slotReady={profileSlotReady}
            hideVerifyButton
            verifying={profileVerifying}
            verified={profileVerified}
            matchPct={profileMatchPct}
            matchThreshold={faceMatchThreshold}
            matchReadoutVariant="profileDl"
            showMatchWhenPct
            slotProcessingLabel="Matching profile to driver license…"
            failLabel={profileVerified ? null : profileFail}
            manualSupportChecked={profileManualSupport}
            onManualSupportChange={onProfileManualSupportChange}
            actionBetweenFrameAndVerify={
              <GovIdUploadButton
                uploadButtonLabel="Upload New Profile"
                onUploadClick={() => setUploadDialogKind('profile')}
              />
            }
          >
            {profilePhotoUrl ? (
              <Box
                component="img"
                src={profilePhotoUrl}
                alt="Your profile photo"
                sx={slotPreviewImgSx}
                onLoad={onProfilePhotoLoad}
                onError={onProfilePhotoError}
              />
            ) : (
              <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontSize: '0.85rem' }}>
                Loading profile photo…
              </ColorTemplate7PopupLargeDark.BodyText>
            )}
          </VerificationSlot>
        </Box>
      </Stack>
    );
  }

  if (wizardStep === WIZARD_STEP_DRIVER_LICENSE) {
    return (
      <Stack spacing={2} sx={wizardStepStackSx}>
        {uploadDialog}
        <WizardStepHeading stepNumber={3} label="Driver License" />
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', width: '100%' }}>
          Upload your driver license. It is matched to your profile photo automatically after upload.
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={wizardStepColumnSx}>
          <VerificationSlot
            title="Driver License"
            columnSx={wizardGovIdSlotColumnSx}
            centerSlotOnPage
            dimSlotPreview={!driverLicenseUserUploaded}
            slotReady={driverLicenseSlotReady}
            hideVerifyButton
            verifying={driverLicenseVerifying}
            verified={driverLicenseVerified}
            matchPct={driverLicenseMatchPct}
            matchThreshold={faceMatchThreshold}
            matchReadoutVariant="dlProfile"
            showMatchWhenPct
            slotProcessingLabel="Extracting and matching driver license…"
            failLabel={driverLicenseVerified ? null : driverLicenseFail}
            manualSupportChecked={driverLicenseManualSupport}
            onManualSupportChange={onDriverLicenseManualSupportChange}
            actionBetweenFrameAndVerify={
              <GovIdUploadActions
                adminImpersonationBypass={adminImpersonationBypass}
                uploadLabel="Upload Driver License ID"
                bypassLabel="By Pass Upload Driver License ID"
                disabled={driverLicenseVerifying}
                onUpload={() => setUploadDialogKind('driver_license')}
                onBypass={() => onBypassDriverLicense?.()}
              />
            }
            footer={
              driverLicenseExtracted ? (
                <Box sx={wizardExtractedFooterWrapSx}>
                  <ExtractedFieldsPanel
                    title="Extracted from Driver License"
                    extracted={driverLicenseExtracted}
                    showPassportLabels={false}
                    inColumn
                  />
                </Box>
              ) : null
            }
          >
            <GovIdFrameContent preview={driverLicensePreview} />
          </VerificationSlot>
        </Box>
      </Stack>
    );
  }

  if (wizardStep === WIZARD_STEP_PASSPORT) {
    return (
      <Stack spacing={2} sx={wizardStepStackSx}>
        {uploadDialog}
        <WizardStepHeading stepNumber={4} label="Passport" />
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', width: '100%' }}>
          Passport verification is completely optional, but taking this step can really help your profile stand out! Statistically,
          verified details—like your citizenship and birth country—make your profile much more attractive to potential matches. Your
          privacy is our top priority. Feel free to cover your passport number with a piece of tape; we just need to clearly see your
          name, photo, country of citizenship, place of birth, and date of birth. To keep your data secure, we only extract these
          details and never store the actual image of your passport. Plus, you are always in control and can choose to hide any of this
          information from your public profile at any time.
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={wizardStepColumnSx}>
          <VerificationSlot
            title="Passport"
            optional
            columnSx={{ ...govIdSlotColumnSx, ...wizardVerificationSlotColumnSx }}
            centerSlotOnPage
            slotReady={passportSlotReady}
            hideVerifyButton
            verifying={passportVerifying}
            verified={passportVerified}
            matchPct={passportMatchPct}
            matchThreshold={faceMatchThreshold}
            matchReadoutVariant="ppProfile"
            showMatchWhenPct
            slotProcessingLabel="Extracting and matching passport…"
            failLabel={passportVerified ? null : passportFail}
            manualSupportChecked={passportManualSupport}
            onManualSupportChange={onPassportManualSupportChange}
            actionBetweenFrameAndVerify={
              <GovIdUploadActions
                adminImpersonationBypass={adminImpersonationBypass}
                uploadLabel="Upload Passport ID"
                bypassLabel="By Pass Upload Passport ID"
                disabled={passportVerifying}
                onUpload={() => setUploadDialogKind('passport')}
                onBypass={() => onBypassPassport?.()}
              />
            }
            footer={
              <ExtractedFieldsPanel
                title="Extracted from Passport"
                extracted={passportExtracted}
                showPassportLabels
                inColumn
              />
            }
          >
            <GovIdFrameContent preview={passportPreview} />
          </VerificationSlot>
        </Box>
      </Stack>
    );
  }

  if (wizardStep === WIZARD_STEP_LIVE_SCAN) {
    const liveFaceScanSlotInner = liveFaceSnapshotPreview ? (
      <Box component="img" src={liveFaceSnapshotPreview} alt="Live face scan snapshot" sx={slotPreviewImgSx} />
    ) : livenessPassed ? (
      <ColorTemplate7PopupLargeDark.BodyText sx={{ ...liveScanStepInstructionBodySx, color: '#2e7d32' }}>
        Liveness PASS
      </ColorTemplate7PopupLargeDark.BodyText>
    ) : skipLiveFaceScan ? (
      <ColorTemplate7PopupLargeDark.BodyText sx={liveScanStepInstructionBodySx}>
        Live face scan optional on this site. Click Live Scan below to run it.
      </ColorTemplate7PopupLargeDark.BodyText>
    ) : (
      <ColorTemplate7PopupLargeDark.BodyText sx={liveScanStepInstructionBodySx}>
        Click Live Scan below to open the live scan window.
      </ColorTemplate7PopupLargeDark.BodyText>
    );

    const liveFaceScanSlotProps = {
      title: 'Live Face Scan',
      centerSlotOnPage: true,
      slotReady: liveFaceSlotReady,
      verifyLabel: 'Live Scan',
      verifyDoneLabel: 'Verify Done',
      lockAfterVerified: true,
      keepVerifyButtonWhenVerified:
        Boolean(liveScanFail) && liveFaceVerified && liveScanMatchSatisfied,
      verifyButtonSx: liveFaceVerifyButtonSx,
      verifyBypassAction: adminImpersonationBypass ? (
        <Button
          variant="contained"
          disableElevation
          disabled={liveFaceBypassDisabled || liveFaceVerifying || (liveFaceVerified && liveScanMatchSatisfied)}
          onClick={() => onBypassLiveScan?.()}
          sx={{ ...adminImpersonationBypassButtonSx, width: '100%', maxWidth: 320 }}
        >
          By Pass Live Scan
        </Button>
      ) : null,
      onVerify: onVerifyLiveFace,
      verifyDisabled: liveFaceVerifyDisabled,
      verifying: liveFaceVerifying,
      verified: liveFaceVerified && liveScanMatchSatisfied,
      slotProcessingLabel: liveFaceVerifying ? 'Running live face scan…' : null,
      matchPct: skipLiveFaceScan ? null : liveFaceMatchPct,
      matchThreshold: faceMatchThreshold,
      showMatchWhenPct: true,
      matchReadoutVariant: 'liveScanProfile',
      failLabel: liveScanManualVideoFallback ? null : liveScanFail,
      instructionFontSize: LIVE_SCAN_STEP_INSTRUCTION_FONT_SIZE
    };

    return (
      <Stack spacing={2} sx={wizardStepStackSx}>
        {uploadDialog}
        <WizardStepHeading stepNumber={4} label="Live Face Scan" />
        <ColorTemplate7PopupLargeDark.BodyText
          sx={{
            textAlign: 'center',
            width: '100%',
            fontWeight: 700,
            fontSize: LIVE_SCAN_STEP_INSTRUCTION_FONT_SIZE,
            lineHeight: 1.25
          }}
        >
          {liveScanManualVideoFallback
            ? 'Record a short video below and send it for manual live scan verification, then click Save.'
            : skipLiveFaceScan
              ? 'Live face scan is optional on this site. Click Live Scan to run it, or Save to finish.'
              : 'Complete live face scan, then click Save to finish verification.'}
        </ColorTemplate7PopupLargeDark.BodyText>
        {liveScanManualVideoFallback ? (
          <Box sx={wizardStepColumnSx}>
            <LiveFaceScanVideoFallback
              firstName={consentFirstName}
              fullNameSigned={consentFullName}
              viewerApprovedId={viewerApprovedId}
              onSent={onLiveScanVideoSent}
              onRecordingDone={onLiveScanVideoRecorded}
              onRecordingCleared={onLiveScanVideoCleared}
            />
          </Box>
        ) : (
          <Box sx={wizardStepColumnSx}>
            <VerificationSlot
              {...liveFaceScanSlotProps}
              columnSx={liveScanWizardColumnSx}
              imageBoxSx={liveScanStepSlotImageBoxSx}
            >
              {liveFaceScanSlotInner}
            </VerificationSlot>
          </Box>
        )}
      </Stack>
    );
  }

  return null;
}

IdentificationVerificationBoard.propTypes = {
  wizardStep: PropTypes.oneOf([2, 3, 4, 5]).isRequired,
  skipLiveFaceScan: PropTypes.bool,
  adminImpersonationBypass: PropTypes.bool,
  onBypassDriverLicense: PropTypes.func,
  onBypassPassport: PropTypes.func,
  onBypassLiveScan: PropTypes.func,
  liveFaceBypassDisabled: PropTypes.bool,
  profilePhotoUrl: PropTypes.string,
  profileSlotReady: PropTypes.bool,
  profilePhotoLoadFailed: PropTypes.bool,
  onProfilePhotoLoad: PropTypes.func,
  onProfilePhotoError: PropTypes.func,
  profileVerifying: PropTypes.bool,
  profileVerified: PropTypes.bool,
  profileMatchPct: PropTypes.number,
  profileVerifyError: PropTypes.string,
  profileManualSupport: PropTypes.bool,
  onProfileManualSupportChange: PropTypes.func,
  onVerifyProfile: PropTypes.func,
  onUploadFilePick: PropTypes.func,
  onUploadPhoneComplete: PropTypes.func,
  driverLicenseUserUploaded: PropTypes.bool,
  driverLicensePreview: PropTypes.string,
  driverLicenseSlotReady: PropTypes.bool,
  driverLicenseVerifying: PropTypes.bool,
  driverLicenseVerified: PropTypes.bool,
  driverLicenseMatchPct: PropTypes.number,
  driverLicenseVerifyError: PropTypes.string,
  driverLicenseManualSupport: PropTypes.bool,
  onDriverLicenseManualSupportChange: PropTypes.func,
  onVerifyDriverLicense: PropTypes.func,
  driverLicenseVerifyDisabled: PropTypes.bool,
  driverLicenseExtracted: PropTypes.object,
  passportPreview: PropTypes.string,
  passportSlotReady: PropTypes.bool,
  passportVerifying: PropTypes.bool,
  passportVerified: PropTypes.bool,
  passportMatchPct: PropTypes.number,
  passportVerifyError: PropTypes.string,
  passportManualSupport: PropTypes.bool,
  onPassportManualSupportChange: PropTypes.func,
  onVerifyPassport: PropTypes.func,
  passportVerifyDisabled: PropTypes.bool,
  passportExtracted: PropTypes.object,
  livenessPassed: PropTypes.bool,
  liveFaceSlotReady: PropTypes.bool,
  liveFaceVerifying: PropTypes.bool,
  liveFaceVerified: PropTypes.bool,
  liveFaceMatchPct: PropTypes.number,
  liveFaceVerifyError: PropTypes.string,
  liveFaceSnapshotPreview: PropTypes.string,
  liveFaceVerifyDisabled: PropTypes.bool,
  liveScanManualVideoFallback: PropTypes.bool,
  liveScanRetryCountdownSec: PropTypes.number,
  faceMatchThreshold: PropTypes.number,
  onVerifyLiveFace: PropTypes.func,
  verifyButtonsEnabled: PropTypes.bool,
  consentFullName: PropTypes.string,
  consentFirstName: PropTypes.string,
  viewerApprovedId: PropTypes.number,
  onLiveScanVideoSent: PropTypes.func,
  onLiveScanVideoRecorded: PropTypes.func,
  onLiveScanVideoCleared: PropTypes.func
};
