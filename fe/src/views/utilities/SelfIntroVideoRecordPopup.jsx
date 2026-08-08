import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import SelfIntroBulbScriptBanner from 'ui-component/SelfIntroBulbScriptBanner';
import SelfIntroRecordControlPad from 'ui-component/SelfIntroRecordControlPad';
import { handlerDrawerOpen } from 'api/menu';
import api from 'api/axios';
import { postSaveSelfIntroVideo, fetchSelfIntroVideoSlots, deleteSelfIntroVideoSlot } from 'api/selfIntroVideoFe';
import { SELF_INTRO_VIDEO_MAX_BYTES, SELF_INTRO_VIDEO_MAX_MB } from 'constants/selfIntroVideoLimits';
import { useAuth } from 'contexts/AuthContext';
import { isAdminImpersonationBypassSession } from 'utils/adminSession';
import { SelfIntroVideoRecorderSlotStrip } from 'views/utilities/SelfIntroVideoLibrary';
import SelfIntroVideoSlotsFullPopup from 'views/utilities/SelfIntroVideoSlotsFullPopup';
import { getSelfIntroVideoMaxLengthSeconds } from 'config/selfIntroVideoMaxLengthEnv';
import { getHoverEnlargeTransform } from 'config/hoverEnlargeEnv';
import { COLOR_TEMPLATE7_POPUP_MAX_HEIGHT } from 'config/colorTemplate7PopupLargeDark';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import { allSelfIntroVideoSlotsFull } from 'utils/selfIntroVideoSlotHelpers';
import fancyFrameImg from 'assets/images/fancyframe.png';
import { applyMicEnabledToStream, blobToDataUrl, pickVideoMimeType } from 'utils/mediaRecorderVideoHelpers';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const SAVED_OVERLAY_MS = 1400;
const VIDEO_SIZE_SCALE_MIN = 0;
const VIDEO_SIZE_SCALE_MAX = 100;
const VIDEO_SIZE_SCALE_STEP = 5;
const VIDEO_SIZE_SCALE_DEFAULT = 50;
const VIDEO_SIZE_BASE_MAX_VW = 40;
const VIDEO_SIZE_MAX_MAX_VW = 75;
const SELF_INTRO_RECORD_VIDEO_ASPECT_RATIO = '982 / 1024';
const FANCY_FRAME_WIDTH_TO_HEIGHT = 982 / 1024;

/** Video preview width at 0% / 50% / 100% on the size slider (vw). */
const VIDEO_SIZE_MIN_VW = VIDEO_SIZE_BASE_MAX_VW - (VIDEO_SIZE_MAX_MAX_VW - VIDEO_SIZE_BASE_MAX_VW);

function getVideoPreviewMaxWidthVw(videoSizePercent = 0) {
  const clamped = Math.min(VIDEO_SIZE_SCALE_MAX, Math.max(VIDEO_SIZE_SCALE_MIN, Number(videoSizePercent) || 0));
  if (clamped <= 50) {
    const t = clamped / 50;
    return VIDEO_SIZE_MIN_VW + (VIDEO_SIZE_BASE_MAX_VW - VIDEO_SIZE_MIN_VW) * t;
  }
  const t = (clamped - 50) / 50;
  return VIDEO_SIZE_BASE_MAX_VW + (VIDEO_SIZE_MAX_MAX_VW - VIDEO_SIZE_BASE_MAX_VW) * t;
}

function videoSizePercentFromMaxWidthVw(targetVw) {
  const clampedVw = Math.min(VIDEO_SIZE_MAX_MAX_VW, Math.max(VIDEO_SIZE_MIN_VW, targetVw));
  let raw;
  if (clampedVw <= VIDEO_SIZE_BASE_MAX_VW) {
    const t = (clampedVw - VIDEO_SIZE_MIN_VW) / (VIDEO_SIZE_BASE_MAX_VW - VIDEO_SIZE_MIN_VW);
    raw = t * 50;
  } else {
    const t = (clampedVw - VIDEO_SIZE_BASE_MAX_VW) / (VIDEO_SIZE_MAX_MAX_VW - VIDEO_SIZE_BASE_MAX_VW);
    raw = 50 + t * 50;
  }
  return Math.min(
    VIDEO_SIZE_SCALE_MAX,
    Math.max(VIDEO_SIZE_SCALE_MIN, Math.round(raw / VIDEO_SIZE_SCALE_STEP) * VIDEO_SIZE_SCALE_STEP)
  );
}

/** Largest slider % so a 4:5 frame fits in the stage height (width capped by slider vw range). */
function computeMaxFittingVideoSizePercent(availableHeightPx, viewportWidthPx) {
  if (availableHeightPx <= 0 || viewportWidthPx <= 0) return VIDEO_SIZE_SCALE_MAX;
  const targetWidthPx = availableHeightPx * FANCY_FRAME_WIDTH_TO_HEIGHT;
  const targetVw = (targetWidthPx / viewportWidthPx) * 100;
  return videoSizePercentFromMaxWidthVw(targetVw);
}

function fitVideoSizePercentToStage(requestedPercent, availableHeightPx, viewportWidthPx) {
  const clamped = Math.min(
    VIDEO_SIZE_SCALE_MAX,
    Math.max(VIDEO_SIZE_SCALE_MIN, Math.round(Number(requestedPercent) || 0))
  );
  const maxFit = computeMaxFittingVideoSizePercent(availableHeightPx, viewportWidthPx);
  return Math.min(clamped, maxFit);
}

function buildVideoPanelSx(videoSizePercent, maxHeightPx = 0) {
  const widthVw = getVideoPreviewMaxWidthVw(videoSizePercent);
  return {
    width: `${widthVw}vw`,
    maxWidth: '100%',
    ...(maxHeightPx > 0 ? { maxHeight: maxHeightPx } : {}),
    height: 'auto',
    aspectRatio: SELF_INTRO_RECORD_VIDEO_ASPECT_RATIO,
    mx: 'auto',
    borderRadius: 0,
    overflow: 'visible',
    boxSizing: 'border-box',
    position: 'relative',
    bgcolor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    containerType: 'inline-size'
  };
}

const fancyFrameOverlaySx = {
  position: 'absolute',
  inset: 0,
  zIndex: 3,
  width: '100%',
  height: '100%',
  objectFit: 'fill',
  pointerEvents: 'none',
  userSelect: 'none'
};

/** Video viewport inside fancyframe.png opening (982×1024 asset). */
const fancyFrameVideoViewportSx = {
  position: 'absolute',
  top: 'calc(17% - 3px)',
  right: 'calc(15.3% - 3px)',
  bottom: 'calc(14.5% - 3px)',
  left: 'calc(16.3% - 3px)',
  zIndex: 0,
  overflow: 'hidden',
  bgcolor: '#000000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

function buildRecordVideoColumnSx(videoSizePercent, maxHeightPx = 0) {
  const widthVw = getVideoPreviewMaxWidthVw(videoSizePercent);
  return {
    flex: { xs: '0 0 auto', sm: '0 0 auto' },
    width: `${widthVw}vw`,
    maxWidth: '100%',
    ...(maxHeightPx > 0 ? { maxHeight: maxHeightPx } : {}),
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    mx: { xs: 'auto', sm: 0 }
  };
}

const recordPopupBodySx = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  maxHeight: COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
  height: COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
  overflow: 'hidden'
};

const videoSizeBarSx = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 0.5,
  py: 0.6,
  bgcolor: '#ffd84d',
  border: '2px solid #000000',
  borderRadius: 1,
  boxSizing: 'border-box'
};

const videoSizeStepButtonSx = {
  minWidth: 34,
  width: 34,
  height: 34,
  p: 0,
  fontWeight: 900,
  fontSize: '1.4rem',
  lineHeight: 1,
  color: '#000000',
  border: '2px solid #000000',
  borderRadius: 0.5,
  bgcolor: '#ffd84d',
  flexShrink: 0
};

const videoSizeSliderSx = {
  color: '#000000',
  flex: 1,
  mx: 0.25,
  '& .MuiSlider-rail': { opacity: 1, bgcolor: '#000000', height: 4 },
  '& .MuiSlider-track': { bgcolor: '#000000', border: 'none', height: 4 },
  '& .MuiSlider-thumb': {
    width: 24,
    height: 24,
    bgcolor: '#ffd84d',
    border: '3px solid #000000',
    boxShadow: 'none',
    '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none' }
  }
};

const videoSizeLabelSx = {
  minWidth: 42,
  textAlign: 'right',
  fontWeight: 800,
  fontSize: { xs: '0.78rem', sm: '0.85rem' },
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  flexShrink: 0
};

const recordStateOverlayBaseSx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 4,
  pointerEvents: 'none',
  fontWeight: 900,
  fontSize: { xs: '2rem', sm: '2.75rem' },
  lineHeight: 1.1,
  textTransform: 'uppercase',
  textAlign: 'center',
  px: 1
};

/** Stroked overlay text — explicit fill beats ColorTemplate7 WebkitTextFillColor cascade. */
const strokedOverlayFillSx = (fillColor, strokePx = 3) => ({
  color: fillColor,
  WebkitTextFillColor: `${fillColor} !important`,
  WebkitTextStrokeWidth: `${strokePx}px`,
  WebkitTextStrokeColor: '#000000',
  paintOrder: 'stroke fill'
});

/** Huge yellow countdown — top of live video while recording. */
const recordingCountdownOverlaySx = {
  position: 'absolute',
  top: '2%',
  left: 0,
  right: 0,
  zIndex: 5,
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  fontWeight: 900,
  fontSize: 'clamp(3.25rem, 26cqw, 7rem)',
  lineHeight: 1,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
  textShadow: '0 3px 14px rgba(0,0,0,0.95)',
  ...strokedOverlayFillSx('#ffd84d', 4)
};

/** Full-width red “Recording” label along bottom of live video. */
const recordingStatusOverlaySx = {
  position: 'absolute',
  bottom: '5%',
  left: 0,
  right: 0,
  width: '100%',
  zIndex: 4,
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontWeight: 900,
  textTransform: 'uppercase',
  fontSize: 'clamp(0.875rem, 9cqw, 4rem)',
  lineHeight: 0.9,
  letterSpacing: '-0.04em',
  whiteSpace: 'nowrap',
  textShadow: '0 2px 10px rgba(0,0,0,0.92)',
  ...strokedOverlayFillSx('#ff0000', 2),
  '@keyframes selfIntroRecordingBlink': {
    '0%, 49%': { opacity: 1 },
    '50%, 100%': { opacity: 0.25 }
  },
  animation: 'selfIntroRecordingBlink 1s step-end infinite'
};

/** Bottom green “Replay cur/total” label while playback is running. */
const replayStatusOverlaySx = {
  position: 'absolute',
  bottom: '5%',
  left: 0,
  right: 0,
  width: '100%',
  zIndex: 5,
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontWeight: 900,
  fontSize: 'clamp(0.875rem, 9cqw, 4rem)',
  lineHeight: 0.9,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
  textShadow: '0 2px 10px rgba(0,0,0,0.92)',
  ...strokedOverlayFillSx('#00e676', 2)
};

const pausedOverlaySx = {
  ...recordStateOverlayBaseSx,
  color: '#000000',
  bgcolor: '#ffd84d',
  animation: 'none'
};

const stoppedOverlaySx = {
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: { xs: '0.12em', sm: '0.18em' },
  bgcolor: 'var(--theme-primary-color)',
  px: 1,
  py: 2,
  animation: 'none'
};

const stoppedOverlayTitleSx = {
  fontWeight: 900,
  lineHeight: 1.05,
  textAlign: 'center',
  width: '100%',
  fontSize: 'clamp(2.25rem, 17cqw, 5.5rem)',
  textShadow: '0 3px 12px rgba(0,0,0,0.95)',
  ...strokedOverlayFillSx('#ff0000', 4)
};

const stoppedOverlayHintSx = {
  fontWeight: 900,
  lineHeight: 1.05,
  textAlign: 'center',
  width: '100%',
  fontSize: 'clamp(1.65rem, 12.5cqw, 4.25rem)',
  textShadow: '0 2px 10px rgba(0,0,0,0.92)',
  ...strokedOverlayFillSx('#ffd84d', 3)
};

const savedOverlaySx = {
  ...recordStateOverlayBaseSx,
  color: '#ffffff',
  bgcolor: '#2e7d32',
  animation: 'none'
};

const micToggleButtonSx = {
  position: 'absolute',
  bottom: '15%',
  right: '17%',
  zIndex: 6,
  width: 52,
  height: 52,
  border: '2px solid #ffffff',
  transform: 'scale(1)',
  transformOrigin: 'center',
  transition: 'transform 180ms ease, background-color 180ms ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
};

const recordStageRowSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { xs: 'center', sm: 'center' },
  justifyContent: { xs: 'center', sm: 'flex-start' },
  gap: { xs: 1.5, sm: 0 },
  width: '100%',
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden'
};

const recordControlsDockSx = {
  flex: { xs: '0 0 auto', sm: '1 1 0' },
  minWidth: 0,
  width: { xs: '100%', sm: 'auto' },
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const recordControlsPanelSx = {
  flex: '0 0 auto',
  width: { xs: '100%', sm: 'auto' },
  maxWidth: { xs: 340, sm: 340 },
  minWidth: { sm: 280 },
  flexShrink: 0,
  bgcolor: 'var(--theme-secondary-color)',
  borderRadius: 2,
  border: '2px solid var(--theme-primary-color)',
  p: { xs: 1.25, sm: 1.5 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  boxSizing: 'border-box'
};

const timerLabelSx = {
  color: '#8b1a1a',
  fontWeight: 700,
  fontSize: { xs: '0.92rem', sm: '1rem' },
  lineHeight: 1.35,
  textAlign: 'center',
  width: '100%'
};

const PLAYBACK_SCRUB_STEP_SEC = 1;

const playbackScrubBarSx = {
  mt: 0.75,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 0.5,
  py: 0.6,
  bgcolor: '#ffd84d',
  border: '2px solid #000000',
  borderRadius: 1,
  boxSizing: 'border-box'
};

const playbackScrubStepButtonSx = {
  minWidth: 34,
  width: 34,
  height: 34,
  p: 0,
  fontWeight: 900,
  fontSize: '1.4rem',
  lineHeight: 1,
  color: '#000000',
  border: '2px solid #000000',
  borderRadius: 0.5,
  bgcolor: '#ffd84d',
  flexShrink: 0
};

const playbackScrubSliderSx = {
  color: '#000000',
  flex: 1,
  mx: 0.25,
  '& .MuiSlider-rail': { opacity: 1, bgcolor: '#000000', height: 4 },
  '& .MuiSlider-track': { bgcolor: '#000000', border: 'none', height: 4 },
  '& .MuiSlider-thumb': {
    width: 24,
    height: 24,
    bgcolor: '#ffd84d',
    border: '3px solid #000000',
    boxShadow: 'none',
    '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none' }
  }
};

/** Task 5 — record self intro video (max length from ~/.ssh/be/.env; pause / stop / save). */
export default function SelfIntroVideoRecordPopup({ open, onClose, scriptText = '', highlightTerms = [], onSaved }) {
  const { user } = useAuth();
  const adminImpersonationUploadBypass = isAdminImpersonationBypassSession(user);
  const maxRecordSeconds = getSelfIntroVideoMaxLengthSeconds();
  const cameraVideoRef = useRef(null);
  const playbackVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedBlobUrlRef = useRef('');
  const libraryPlaybackUrlRef = useRef('');
  const micEnabledRef = useRef(true);
  const countdownIntervalRef = useRef(null);
  const savedOverlayTimerRef = useRef(null);
  const saveRecordedBlobRef = useRef(async () => false);
  const loadSlotVideoRef = useRef(async () => {});
  const scrubbingRef = useRef(false);

  const [cameraError, setCameraError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [recorderState, setRecorderState] = useState('idle');
  const [secondsLeft, setSecondsLeft] = useState(maxRecordSeconds);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState('');
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [reviewPlaybackActive, setReviewPlaybackActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOverlayVisible, setSavedOverlayVisible] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [scriptFontScalePercent, setScriptFontScalePercent] = useState(0);
  const [videoSizePercent, setVideoSizePercent] = useState(VIDEO_SIZE_SCALE_DEFAULT);
  const [layoutAutoFitNonce, setLayoutAutoFitNonce] = useState(0);
  const [stageHeightPx, setStageHeightPx] = useState(0);
  const [viewportWidthPx, setViewportWidthPx] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0
  );
  const [videoSlots, setVideoSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [libraryPlaybackUrl, setLibraryPlaybackUrl] = useState('');
  const [activeSlotVideoId, setActiveSlotVideoId] = useState(null);
  const [slotVideoLoading, setSlotVideoLoading] = useState(false);
  const [slotsFullOpen, setSlotsFullOpen] = useState(false);
  const recordStageRef = useRef(null);

  const clampVideoSizePercent = useCallback((next) => {
    return Math.min(VIDEO_SIZE_SCALE_MAX, Math.max(VIDEO_SIZE_SCALE_MIN, Math.round(next)));
  }, []);

  const applyVideoSizeChange = useCallback(
    (nextPercent) => {
      const clamped = clampVideoSizePercent(nextPercent);
      if (stageHeightPx > 0 && viewportWidthPx > 0) {
        return fitVideoSizePercentToStage(clamped, stageHeightPx, viewportWidthPx);
      }
      return clamped;
    },
    [clampVideoSizePercent, stageHeightPx, viewportWidthPx]
  );

  const videoPanelSxLive = useMemo(
    () => buildVideoPanelSx(videoSizePercent, stageHeightPx),
    [videoSizePercent, stageHeightPx]
  );
  const recordVideoColumnSxLive = useMemo(
    () => buildRecordVideoColumnSx(videoSizePercent, stageHeightPx),
    [videoSizePercent, stageHeightPx]
  );
  const videoSizeBarLiveSx = useMemo(
    () => ({
      ...videoSizeBarSx,
      width: `${getVideoPreviewMaxWidthVw(videoSizePercent)}vw`,
      maxWidth: '100%',
      alignSelf: { xs: 'center', sm: 'flex-start' }
    }),
    [videoSizePercent]
  );
  const recordingActive = recorderState === 'recording' || recorderState === 'paused';
  const playbackSourceUrl = libraryPlaybackUrl || recordedBlobUrl;
  const reviewingPlayback =
    Boolean(playbackSourceUrl) || Boolean(activeSlotVideoId) || slotVideoLoading || Boolean(recordedBlob);
  const showRecordedPlayback =
    !recordingActive && !savedOverlayVisible && (replaying || (reviewingPlayback && recorderState === 'stopped'));
  const showLiveCamera = !showRecordedPlayback;
  const canReplay =
    Boolean(playbackSourceUrl) && !recordingActive && !savedOverlayVisible && !slotVideoLoading;
  const canSave = Boolean(recordedBlob) && !recordingActive && !saving && !savedOverlayVisible;
  const canStartRecord = !recordingActive && !saving && !cameraError && !savedOverlayVisible;

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current != null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearSavedOverlayTimer = useCallback(() => {
    if (savedOverlayTimerRef.current != null) {
      clearTimeout(savedOverlayTimerRef.current);
      savedOverlayTimerRef.current = null;
    }
  }, []);

  const revokeRecordedUrl = useCallback(() => {
    if (recordedBlobUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current);
      recordedBlobUrlRef.current = '';
    }
  }, []);

  const revokeLibraryPlaybackUrl = useCallback(() => {
    if (libraryPlaybackUrlRef.current) {
      URL.revokeObjectURL(libraryPlaybackUrlRef.current);
      libraryPlaybackUrlRef.current = '';
    }
  }, []);

  const refreshVideoSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const next = await fetchSelfIntroVideoSlots();
      const normalized = Array.isArray(next) ? next : [];
      setVideoSlots(normalized);
      return normalized;
    } catch {
      setVideoSlots([]);
      return [];
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  const attachStreamToCamera = useCallback(async () => {
    if (!cameraVideoRef.current || !streamRef.current) return;
    cameraVideoRef.current.srcObject = streamRef.current;
    await cameraVideoRef.current.play().catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      applyMicEnabledToStream(stream, micEnabledRef.current);
      streamRef.current = stream;
      await attachStreamToCamera();
      return true;
    } catch (err) {
      setCameraError(sanitizeUserFacingTechTerms(err?.message || 'Could not access camera or microphone.'));
      return false;
    }
  }, [attachStreamToCamera, stopStream]);

  const finishRecording = useCallback(
    (blob) => {
      clearCountdownInterval();
      if (!blob || !blob.size) {
        setStatusText('Recording failed. Click Stop and try again.');
        setRecorderState('idle');
        setSecondsLeft(maxRecordSeconds);
        return;
      }
      revokeRecordedUrl();
      const url = URL.createObjectURL(blob);
      recordedBlobUrlRef.current = url;
      setRecordedBlobUrl(url);
      setRecordedBlob(blob);
      setReplaying(false);
      setRecorderState('stopped');
      setSecondsLeft(maxRecordSeconds);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      setReviewPlaybackActive(false);
      setStatusText('');
    },
    [clearCountdownInterval, revokeRecordedUrl]
  );

  const beginRecording = useCallback(async () => {
    if (!streamRef.current) {
      const ok = await startCamera();
      if (!ok) return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    chunksRef.current = [];
    revokeRecordedUrl();
    revokeLibraryPlaybackUrl();
    setRecordedBlobUrl('');
    setRecordedBlob(null);
    setLibraryPlaybackUrl('');
    setActiveSlotVideoId(null);
    setSlotVideoLoading(false);
    setReplaying(false);
    setSavedOverlayVisible(false);
    setStatusText('');
    setSecondsLeft(maxRecordSeconds);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setReviewPlaybackActive(false);

    const mimeType = pickVideoMimeType({ includeAudio: micEnabledRef.current });
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, { mimeType });
    } catch (err) {
      setCameraError(sanitizeUserFacingTechTerms(err?.message || 'Could not start video recording.'));
      setRecorderState('idle');
      return;
    }

    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
      finishRecording(blob);
      void saveRecordedBlobRef.current(blob);
    };
    recorder.onerror = () => {
      setRecorderState('idle');
      setStatusText('Recording error. Try again.');
    };

    recorder.start(1000);
    setRecorderState('recording');
    await attachStreamToCamera();
  }, [attachStreamToCamera, finishRecording, revokeLibraryPlaybackUrl, revokeRecordedUrl, startCamera]);

  const ensureCanStartRecording = useCallback(async () => {
    const currentSlots = await refreshVideoSlots();
    if (allSelfIntroVideoSlotsFull(currentSlots)) {
      setSlotsFullOpen(true);
      return false;
    }
    return true;
  }, [refreshVideoSlots]);

  const tryBeginRecording = useCallback(async () => {
    const canRecord = await ensureCanStartRecording();
    if (!canRecord) return;
    await beginRecording();
  }, [beginRecording, ensureCanStartRecording]);

  const resetToLiveCamera = useCallback(async () => {
    revokeRecordedUrl();
    revokeLibraryPlaybackUrl();
    setRecordedBlobUrl('');
    setRecordedBlob(null);
    setLibraryPlaybackUrl('');
    setActiveSlotVideoId(null);
    setSlotVideoLoading(false);
    setReplaying(false);
    setRecorderState('idle');
    setSecondsLeft(maxRecordSeconds);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setReviewPlaybackActive(false);
    setStatusText('');
    if (streamRef.current) {
      await attachStreamToCamera();
      return;
    }
    await startCamera();
  }, [attachStreamToCamera, maxRecordSeconds, revokeLibraryPlaybackUrl, revokeRecordedUrl, startCamera]);

  const cleanupSession = useCallback(() => {
    clearCountdownInterval();
    clearSavedOverlayTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    revokeRecordedUrl();
    revokeLibraryPlaybackUrl();
    setRecordedBlobUrl('');
    setRecordedBlob(null);
    setLibraryPlaybackUrl('');
    setActiveSlotVideoId(null);
    setSlotVideoLoading(false);
    setReplaying(false);
    setRecorderState('idle');
    setSecondsLeft(maxRecordSeconds);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setReviewPlaybackActive(false);
    setSavedOverlayVisible(false);
    setStatusText('');
    setSaving(false);
    setCameraError('');
  }, [clearCountdownInterval, clearSavedOverlayTimer, revokeLibraryPlaybackUrl, revokeRecordedUrl, stopStream]);

  useEffect(() => {
    if (recorderState !== 'recording') {
      clearCountdownInterval();
      return undefined;
    }

    countdownIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearCountdownInterval();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearCountdownInterval();
  }, [clearCountdownInterval, recorderState]);

  useEffect(() => {
    if (!open) {
      cleanupSession();
      return undefined;
    }

    handlerDrawerOpen(false);
    setScriptFontScalePercent(0);
    setVideoSizePercent(VIDEO_SIZE_SCALE_DEFAULT);
    setStageHeightPx(0);
    setViewportWidthPx(window.innerWidth);
    setLayoutAutoFitNonce((nonce) => nonce + 1);

    let cancelled = false;

    const boot = async () => {
      const ok = await startCamera();
      if (!ok || cancelled) return;
      micEnabledRef.current = true;
      setMicEnabled(true);
      setRecorderState('idle');
    };

    void boot();
    void refreshVideoSlots();

    return () => {
      cancelled = true;
      cleanupSession();
    };
    // Only re-run when popup opens/closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const syncViewport = () => setViewportWidthPx(window.innerWidth);
    const syncStage = () => {
      const stage = recordStageRef.current;
      setStageHeightPx(stage?.clientHeight ?? 0);
    };

    syncViewport();
    syncStage();

    window.addEventListener('resize', syncViewport);
    window.addEventListener('resize', syncStage);

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncStage();
          })
        : null;
    const stage = recordStageRef.current;
    if (observer && stage) observer.observe(stage);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('resize', syncStage);
      observer?.disconnect();
    };
  }, [open, layoutAutoFitNonce]);

  useEffect(() => {
    if (!open || stageHeightPx <= 0 || viewportWidthPx <= 0) return;
    setVideoSizePercent((prev) => fitVideoSizePercentToStage(prev, stageHeightPx, viewportWidthPx));
  }, [open, stageHeightPx, viewportWidthPx]);

  useEffect(() => {
    if (!playbackSourceUrl || !showRecordedPlayback) return undefined;
    const playback = playbackVideoRef.current;
    if (!playback) return undefined;

    let cancelled = false;

    const primeStoppedPreview = async () => {
      if (playback.src !== playbackSourceUrl) {
        playback.src = playbackSourceUrl;
        await playback.load().catch(() => {});
      }
      if (cancelled) return;
      if (!replaying) {
        playback.pause();
        try {
          playback.currentTime = playbackPosition;
        } catch {
          playback.currentTime = 0;
        }
      }
      const syncDuration = () => {
        if (Number.isFinite(playback.duration) && playback.duration > 0) {
          setPlaybackDuration(playback.duration);
        }
      };
      if (playback.readyState >= 1) syncDuration();
      else playback.addEventListener('loadedmetadata', syncDuration, { once: true });
    };

    void primeStoppedPreview();

    return () => {
      cancelled = true;
    };
  }, [playbackSourceUrl, playbackPosition, replaying, showRecordedPlayback]);

  useEffect(() => {
    if (!replaying || !playbackSourceUrl) return undefined;
    const playback = playbackVideoRef.current;
    if (!playback) return undefined;

    const onTimeUpdate = () => {
      if (scrubbingRef.current) return;
      setPlaybackPosition(playback.currentTime);
    };
    const onEnded = () => setReplaying(false);
    const onLoadedMetadata = () => {
      if (Number.isFinite(playback.duration) && playback.duration > 0) {
        setPlaybackDuration(playback.duration);
      }
    };

    playback.addEventListener('timeupdate', onTimeUpdate);
    playback.addEventListener('ended', onEnded);
    playback.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      playback.removeEventListener('timeupdate', onTimeUpdate);
      playback.removeEventListener('ended', onEnded);
      playback.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [replaying, playbackSourceUrl]);

  const handleTogglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      setRecorderState('paused');
      return;
    }
    if (recorder.state === 'paused') {
      recorder.resume();
      setRecorderState('recording');
    }
  }, []);

  const handleStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    clearCountdownInterval();
    try {
      recorder.stop();
    } catch {
      // ignore
    }
  }, [clearCountdownInterval]);

  const saveRecordedBlob = useCallback(
    async (blob) => {
      if (!blob?.size || saving || savedOverlayVisible) return false;
      if (!adminImpersonationUploadBypass && blob.size > SELF_INTRO_VIDEO_MAX_BYTES) {
        setStatusText(`Video exceeds ${SELF_INTRO_VIDEO_MAX_MB} MB limit. Please record a shorter clip.`);
        return false;
      }
      const currentSlots = await refreshVideoSlots();
      if (allSelfIntroVideoSlotsFull(currentSlots)) {
        setSlotsFullOpen(true);
        return false;
      }
      setSaving(true);
      setStatusText('');
      try {
        const dataUrl = await blobToDataUrl(blob);
        const result = await postSaveSelfIntroVideo(dataUrl);
        const savedVideoId = Number(result?.video_id);
        await refreshVideoSlots();
        setSaving(false);
        if (Number.isFinite(savedVideoId) && savedVideoId > 0) {
          await loadSlotVideoRef.current(savedVideoId, { ignoreBusy: true });
        }
        setSavedOverlayVisible(true);
        onSaved?.(result);
        clearSavedOverlayTimer();
        savedOverlayTimerRef.current = setTimeout(() => {
          setSavedOverlayVisible(false);
        }, SAVED_OVERLAY_MS);
        return true;
      } catch (err) {
        const data = err?.response?.data;
        const message = sanitizeUserFacingTechTerms(data?.error || err?.message || 'Failed to save video.');
        if (data?.code === 'DUPLICATE_UPLOAD') {
          setStatusText(message);
        } else if (/full|three|3 video/i.test(message)) {
          setSlotsFullOpen(true);
        } else {
          setStatusText(message);
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [adminImpersonationUploadBypass, clearSavedOverlayTimer, onSaved, refreshVideoSlots, savedOverlayVisible, saving]
  );

  saveRecordedBlobRef.current = saveRecordedBlob;

  useEffect(() => {
    if (secondsLeft !== 0 || recorderState !== 'recording') return;
    handleStop();
  }, [handleStop, recorderState, secondsLeft]);

  const handleToggleMic = useCallback(() => {
    if (recordingActive) return;
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    setMicEnabled(next);
    applyMicEnabledToStream(streamRef.current, next);
  }, [recordingActive]);

  const handleStopReplay = useCallback(() => {
    const playback = playbackVideoRef.current;
    if (playback) {
      playback.pause();
      if (Number.isFinite(playback.currentTime)) {
        setPlaybackPosition(playback.currentTime);
      }
    }
    setReplaying(false);
  }, []);

  const seekPlaybackTo = useCallback((nextSeconds, { pause = true } = {}) => {
    const playback = playbackVideoRef.current;
    const clamped = Math.max(0, nextSeconds);
    setPlaybackPosition(clamped);
    setReviewPlaybackActive(true);
    if (!playback) return;
    if (pause) playback.pause();
    try {
      playback.currentTime = clamped;
    } catch {
      // ignore seek before metadata
    }
  }, []);

  const handleScrubSliderChange = useCallback(
    (_event, value) => {
      scrubbingRef.current = true;
      const next = Array.isArray(value) ? value[0] : value;
      seekPlaybackTo(Number(next), { pause: true });
      if (replaying) setReplaying(false);
    },
    [replaying, seekPlaybackTo]
  );

  const handleScrubSliderCommitted = useCallback(() => {
    scrubbingRef.current = false;
  }, []);

  const handleScrubStepBack = useCallback(() => {
    seekPlaybackTo(playbackPosition - PLAYBACK_SCRUB_STEP_SEC, { pause: true });
    if (replaying) setReplaying(false);
  }, [playbackPosition, replaying, seekPlaybackTo]);

  const handleScrubStepForward = useCallback(() => {
    const max = playbackDuration > 0 ? playbackDuration : maxRecordSeconds;
    seekPlaybackTo(Math.min(max, playbackPosition + PLAYBACK_SCRUB_STEP_SEC), { pause: true });
    if (replaying) setReplaying(false);
  }, [playbackDuration, playbackPosition, replaying, seekPlaybackTo]);

  const loadSlotVideo = useCallback(
    async (videoId, { ignoreBusy = false } = {}) => {
      if (!videoId) return;
      if (!ignoreBusy && (recordingActive || saving || savedOverlayVisible)) return;
      handleStopReplay();
      setStatusText('');
      setActiveSlotVideoId(videoId);
      setRecorderState('stopped');
      setReviewPlaybackActive(true);
      setReplaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      revokeRecordedUrl();
      revokeLibraryPlaybackUrl();
      setRecordedBlobUrl('');
      setRecordedBlob(null);
      setLibraryPlaybackUrl('');
      setSlotVideoLoading(true);
      try {
        const { data } = await api.get(`/api/video/${videoId}`, { responseType: 'blob' });
        const url = URL.createObjectURL(data);
        libraryPlaybackUrlRef.current = url;
        setLibraryPlaybackUrl(url);
      } catch (err) {
        setActiveSlotVideoId(null);
        setRecorderState('idle');
        setReviewPlaybackActive(false);
        setStatusText(sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Could not load saved video.'));
        await attachStreamToCamera();
      } finally {
        setSlotVideoLoading(false);
      }
    },
    [
      attachStreamToCamera,
      handleStopReplay,
      recordingActive,
      revokeLibraryPlaybackUrl,
      revokeRecordedUrl,
      savedOverlayVisible,
      saving
    ]
  );

  loadSlotVideoRef.current = loadSlotVideo;

  const handleRemoveSlot = useCallback(
    async (slot) => {
      if (recordingActive || saving || savedOverlayVisible) return;
      setStatusText('');
      setSlotsLoading(true);
      try {
        const removedEntry = videoSlots.find((entry) => Number(entry?.slot) === Number(slot));
        await deleteSelfIntroVideoSlot(slot);
        if (removedEntry?.videoId && removedEntry.videoId === activeSlotVideoId) {
          await resetToLiveCamera();
        }
        await refreshVideoSlots();
        onSaved?.();
      } catch (err) {
        setStatusText(
          sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Could not delete saved video.')
        );
      } finally {
        setSlotsLoading(false);
      }
    },
    [
      activeSlotVideoId,
      onSaved,
      recordingActive,
      refreshVideoSlots,
      resetToLiveCamera,
      savedOverlayVisible,
      saving,
      videoSlots
    ]
  );

  const resumePlayback = useCallback(async () => {
    let sourceUrl = playbackSourceUrl || libraryPlaybackUrlRef.current;
    if (activeSlotVideoId && !sourceUrl) {
      await loadSlotVideo(activeSlotVideoId);
      sourceUrl = libraryPlaybackUrlRef.current;
    }
    if (!sourceUrl) return false;

    setReviewPlaybackActive(true);
    const playback = playbackVideoRef.current;
    if (!playback) {
      setReplaying(true);
      return true;
    }
    if (playback.src !== sourceUrl) {
      playback.src = sourceUrl;
      await playback.load().catch(() => {});
    }
    try {
      playback.currentTime = playbackPosition;
      setReplaying(true);
      await playback.play();
      return true;
    } catch {
      setStatusText('Could not play recording.');
      setReplaying(false);
      return false;
    }
  }, [activeSlotVideoId, loadSlotVideo, playbackPosition, playbackSourceUrl]);

  const handlePlayButton = useCallback(async () => {
    if (recordingActive || saving || savedOverlayVisible || slotVideoLoading) return;

    const sourceUrl = playbackSourceUrl || libraryPlaybackUrlRef.current;
    const canPlaySource = Boolean(sourceUrl) || Boolean(activeSlotVideoId);
    if (canPlaySource && !recordingActive && !savedOverlayVisible) {
      await resumePlayback();
      return;
    }
    if (canStartRecord) {
      void tryBeginRecording();
    }
  }, [
    activeSlotVideoId,
    canStartRecord,
    playbackSourceUrl,
    recordingActive,
    resumePlayback,
    savedOverlayVisible,
    saving,
    slotVideoLoading,
    tryBeginRecording
  ]);

  const handlePauseButton = useCallback(async () => {
    if (replaying) {
      const playback = playbackVideoRef.current;
      if (playback) {
        playback.pause();
        if (Number.isFinite(playback.currentTime)) {
          setPlaybackPosition(playback.currentTime);
        }
      }
      setReplaying(false);
      setReviewPlaybackActive(true);
      return;
    }
    if (recordingActive) {
      handleTogglePause();
      return;
    }
    if (canReplay && reviewPlaybackActive) {
      await resumePlayback();
    }
  }, [canReplay, handleTogglePause, recordingActive, replaying, resumePlayback, reviewPlaybackActive]);

  const handleSkipButton = useCallback(() => {
    if (recordingActive || saving || savedOverlayVisible) return;
    if (replaying) {
      handleStopReplay();
    }
    if (canStartRecord) {
      void tryBeginRecording();
    }
  }, [canStartRecord, handleStopReplay, recordingActive, replaying, savedOverlayVisible, saving, tryBeginRecording]);

  const handleStopButton = useCallback(() => {
    if (recordingActive) {
      handleStop();
      return;
    }
    if (replaying) {
      handleStopReplay();
    }
  }, [handleStop, handleStopReplay, recordingActive, replaying]);

  const handleSave = useCallback(async () => {
    if (!recordedBlob) return;
    await saveRecordedBlob(recordedBlob);
  }, [recordedBlob, saveRecordedBlob]);

  const handleCancel = useCallback(() => {
    cleanupSession();
    onClose?.();
  }, [cleanupSession, onClose]);

  const showPlaybackScrubBar = canReplay;
  const scrubMax = playbackDuration > 0 ? playbackDuration : maxRecordSeconds;
  const showReplayOverlay =
    Boolean(playbackSourceUrl) && showRecordedPlayback && (replaying || reviewPlaybackActive);
  const replayOverlayLabel = `Replay ${playbackPosition.toFixed(1)}/${Math.round(scrubMax)}`;
  const playbackPauseToggleAvailable = canReplay && reviewPlaybackActive && !recordingActive;
  const showStoppedOverlay =
    Boolean(recordedBlob) &&
    recorderState === 'stopped' &&
    !replaying &&
    !savedOverlayVisible &&
    !reviewPlaybackActive &&
    !saving;

  return (
    <>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={handleCancel}
        closeOnBackdrop={false}
        bodyTextAlignLeft
        closeButtonAriaLabel="Close self intro video recorder"
      >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5} sx={recordPopupBodySx}>
        <Box {...guestDemoAllowProps()} sx={{ display: 'contents' }}>
        <Box sx={{ flexShrink: 0, width: '100%' }}>
          <SelfIntroBulbScriptBanner
            scriptText={scriptText}
            highlightTerms={highlightTerms}
            fontScalePercent={scriptFontScalePercent}
            onFontScalePercentChange={setScriptFontScalePercent}
            autoFitFontScaleNonce={layoutAutoFitNonce}
          />
        </Box>

        <Box
          sx={{ ...videoSizeBarLiveSx, flexShrink: 0 }}
          role="group"
          aria-label="Video preview size"
          {...guestDemoAllowProps()}
        >
          <IconButton
            type="button"
            aria-label="Decrease video preview size"
            onClick={() => setVideoSizePercent((prev) => applyVideoSizeChange(prev - VIDEO_SIZE_SCALE_STEP))}
            disabled={videoSizePercent <= VIDEO_SIZE_SCALE_MIN}
            sx={videoSizeStepButtonSx}
            {...guestDemoAllowProps()}
          >
            −
          </IconButton>
          <Slider
            value={videoSizePercent}
            min={VIDEO_SIZE_SCALE_MIN}
            max={VIDEO_SIZE_SCALE_MAX}
            step={VIDEO_SIZE_SCALE_STEP}
            onChange={(_event, value) =>
              setVideoSizePercent(applyVideoSizeChange(Array.isArray(value) ? value[0] : value))
            }
            aria-label="Video preview size"
            sx={videoSizeSliderSx}
          />
          <IconButton
            type="button"
            aria-label="Increase video preview size"
            onClick={() => setVideoSizePercent((prev) => applyVideoSizeChange(prev + VIDEO_SIZE_SCALE_STEP))}
            disabled={videoSizePercent >= VIDEO_SIZE_SCALE_MAX}
            {...guestDemoAllowProps()}
            sx={videoSizeStepButtonSx}
          >
            +
          </IconButton>
          <Typography component="span" sx={videoSizeLabelSx} aria-hidden>
            {videoSizePercent}%
          </Typography>
        </Box>

        <Box ref={recordStageRef} sx={recordStageRowSx}>
          <Box sx={recordVideoColumnSxLive}>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box sx={videoPanelSxLive} data-idv-capture-skip="true">
                <Box sx={fancyFrameVideoViewportSx}>
                <Box
                  component="video"
                  ref={cameraVideoRef}
                  autoPlay
                  muted
                  playsInline
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: showLiveCamera ? 'block' : 'none'
                  }}
                />
                <Box
                  component="video"
                  ref={playbackVideoRef}
                  controls={false}
                  playsInline
                  onEnded={() => setReplaying(false)}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: showRecordedPlayback ? 'block' : 'none'
                  }}
                />
                {slotVideoLoading ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 3,
                      display: showRecordedPlayback ? 'flex' : 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    Loading…
                  </Box>
                ) : null}
                {recordingActive ? <Box sx={recordingCountdownOverlaySx}>{secondsLeft} sec</Box> : null}
                {recorderState === 'recording' ? <Box sx={recordingStatusOverlaySx}>Recording</Box> : null}
                {showReplayOverlay ? (
                  <Box sx={replayStatusOverlaySx} aria-live="polite">
                    {replayOverlayLabel}
                  </Box>
                ) : null}
                {recorderState === 'paused' ? <Box sx={pausedOverlaySx}>Pause</Box> : null}
                {showStoppedOverlay ? (
                  <Box sx={stoppedOverlaySx}>
                    <Box component="span" sx={stoppedOverlayTitleSx}>
                      Save failed
                    </Box>
                    <Box component="span" sx={stoppedOverlayHintSx}>
                      Click Save to retry
                    </Box>
                    <Box component="span" sx={stoppedOverlayHintSx}>
                      Or Click Rec
                    </Box>
                    <Box component="span" sx={stoppedOverlayHintSx}>
                      To Rerecord
                    </Box>
                  </Box>
                ) : null}
                {savedOverlayVisible ? <Box sx={savedOverlaySx}>Saved</Box> : null}
                </Box>
                <Box
                  component="img"
                  src={fancyFrameImg}
                  alt=""
                  aria-hidden
                  draggable={false}
                  sx={fancyFrameOverlaySx}
                />
                <IconButton
                  type="button"
                  aria-label={micEnabled ? 'Turn microphone off' : 'Turn microphone on'}
                  aria-pressed={micEnabled}
                  onClick={() => void handleToggleMic()}
                  disabled={recordingActive || savedOverlayVisible || showRecordedPlayback}
                  {...guestDemoAllowProps()}
                  sx={{
                    ...micToggleButtonSx,
                    bgcolor: micEnabled ? '#43a047' : '#e53935',
                    color: '#ffffff',
                    '@media (hover: hover)': {
                      '&:hover': {
                        transform: getHoverEnlargeTransform(),
                        bgcolor: micEnabled ? '#388e3c' : '#c62828'
                      }
                    }
                  }}
                >
                  {micEnabled ? <MicIcon sx={{ fontSize: 28 }} /> : <MicOffIcon sx={{ fontSize: 28 }} />}
                </IconButton>
              </Box>
              {showPlaybackScrubBar ? (
                <Box sx={playbackScrubBarSx} role="group" aria-label="Recording playback position">
                  <IconButton
                    type="button"
                    aria-label="Rewind recording one second"
                    onClick={handleScrubStepBack}
                    disabled={playbackPosition <= 0}
                    sx={playbackScrubStepButtonSx}
                  >
                    −
                  </IconButton>
                  <Slider
                    value={Math.min(playbackPosition, scrubMax)}
                    min={0}
                    max={scrubMax}
                    step={0.1}
                    onChange={handleScrubSliderChange}
                    onChangeCommitted={handleScrubSliderCommitted}
                    aria-label="Seek through recording"
                    sx={playbackScrubSliderSx}
                  />
                  <IconButton
                    type="button"
                    aria-label="Forward recording one second"
                    onClick={handleScrubStepForward}
                    disabled={playbackPosition >= scrubMax}
                    sx={playbackScrubStepButtonSx}
                  >
                    +
                  </IconButton>
                </Box>
              ) : null}
            </Box>
          </Box>

          <Box sx={recordControlsDockSx} {...guestDemoAllowProps()}>
            <Box sx={recordControlsPanelSx} {...guestDemoAllowProps()}>
            <Typography sx={timerLabelSx} aria-live="polite">
              Record time left: {secondsLeft} sec of {maxRecordSeconds} sec
            </Typography>
            <SelfIntroRecordControlPad
              onPlay={handlePlayButton}
              onPause={handlePauseButton}
              onSkip={handleSkipButton}
              onStop={handleStopButton}
              onSave={() => void handleSave()}
              playDisabled={(!canStartRecord && !canReplay) || slotVideoLoading}
              pauseDisabled={!recordingActive && !replaying && !playbackPauseToggleAvailable}
              skipDisabled={!canStartRecord}
              stopDisabled={!recordingActive && !replaying}
              saveDisabled={!canSave}
            />
            <SelfIntroVideoRecorderSlotStrip
              slots={videoSlots}
              activeVideoId={activeSlotVideoId}
              onSelectVideo={(videoId) => void loadSlotVideo(videoId)}
              onRemoveSlot={(slot) => void handleRemoveSlot(slot)}
              disabled={recordingActive || saving || savedOverlayVisible || slotsLoading}
            />
            </Box>
          </Box>
        </Box>

        {cameraError ? <ColorTemplate7PopupLargeDark.ErrorBar>{cameraError}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {statusText ? <ColorTemplate7PopupLargeDark.ErrorBar>{statusText}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
      <SelfIntroVideoSlotsFullPopup open={slotsFullOpen} onClose={() => setSlotsFullOpen(false)} />
    </>
  );
}

SelfIntroVideoRecordPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  scriptText: PropTypes.string,
  highlightTerms: PropTypes.arrayOf(PropTypes.string),
  onSaved: PropTypes.func
};
