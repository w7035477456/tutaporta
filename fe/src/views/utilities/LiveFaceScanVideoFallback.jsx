import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  consentRecordVideoUrl,
  fetchConsentVideoObjectUrl,
  postSaveLiveFaceScanVideoConsent
} from 'api/consentRecordFe';
import { pickRandomLiveFaceScanScriptPhrase } from 'constants/liveFaceScanVideoScriptPhrases';
import { getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { COLOR_TEMPLATE7_POPUP_PANEL_BG } from 'config/colorTemplate7PopupLargeDark';
import { getHoverEnlargeTransform } from 'config/hoverEnlargeEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import { BUTTON_TEMPLATE_THICK_BLACK_BORDER } from 'config/selectedUnselectedButtonTemplate';
import {
  getLiveFaceScanRecordVideoControlWidthSx,
  getLiveFaceScanRecordVideoFrameSx,
  getLiveFaceScanScriptBannerFrameSx
} from 'config/liveFaceScanManualVideoEnv';

const COUNTDOWN_SECONDS = 5;
const SCRIPT_SECONDS = 10;
const TURN_LEFT_SECONDS = 5;
const TURN_RIGHT_SECONDS = 5;
const DONE_SECONDS = 3;

const PHASE = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  SCRIPT: 'script',
  TURN_LEFT: 'turnLeft',
  TURN_RIGHT: 'turnRight',
  DONE: 'done'
};

const liveScanVideoButtonSx = {
  bgcolor: '#43a047 !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`,
  boxShadow: 'none !important',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
  minHeight: { xs: 44, sm: 48 },
  py: { xs: 0.85, sm: 1 },
  px: { xs: 1.25, sm: 1.5 },
  fontWeight: 700,
  flex: '0 0 auto',
  minWidth: { xs: 96, sm: 108 },
  fontSize: { xs: '0.82rem', sm: '0.9rem' },
  '&:hover': {
    bgcolor: '#388e3c !important',
    boxShadow: 'none !important',
    border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`
  },
  '&:disabled': {
    bgcolor: 'rgba(67, 160, 71, 0.45) !important',
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important',
    border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important`
  }
};

const liveScanVideoButtonFitSx = {
  ...liveScanVideoButtonSx,
  width: 'auto',
  alignSelf: 'center'
};

const liveScanVideoControlsColumnSx = {
  width: '100%',
  mx: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  alignSelf: 'center',
  gap: 1.25
};

const scriptBannerFontSizeSx = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

const scriptBannerTextSx = {
  px: { xs: 1.5, sm: 2 },
  py: { xs: 1.25, sm: 1.5 },
  textAlign: 'center',
  fontWeight: 700,
  fontSize: scriptBannerFontSizeSx,
  lineHeight: 1.45,
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important'
};

const videoPanelSx = getLiveFaceScanRecordVideoFrameSx();

const recordingStatusTextStroke = '2px #000000';

const recordingStatusLabelSx = {
  alignSelf: 'center',
  fontWeight: 900,
  fontSize: scriptBannerFontSizeSx,
  lineHeight: 1.2,
  WebkitTextStroke: recordingStatusTextStroke,
  paintOrder: 'stroke fill'
};

const recordingStatusOverlaySx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 4,
  pointerEvents: 'none',
  fontSize: { xs: '2.25rem', sm: '2.75rem' },
  textShadow: '0 2px 10px rgba(0,0,0,0.92)'
};

const countdownCenterSx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3,
  pointerEvents: 'none',
  color: '#ffd84d',
  fontSize: { xs: '4.75rem', sm: '5.75rem' },
  fontWeight: 900,
  lineHeight: 1,
  textShadow: '0 2px 10px rgba(0,0,0,0.92)'
};

const micToggleButtonSx = {
  position: 'absolute',
  bottom: { xs: 4, sm: 8 },
  right: { xs: 4, sm: 8 },
  zIndex: 6,
  width: 52,
  height: 52,
  border: '2px solid #ffffff',
  transform: 'scale(1)',
  transformOrigin: 'center',
  transition: 'transform 180ms ease, background-color 180ms ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
};

const liveFaceScanFallbackRootSx = {
  width: '100%',
  alignItems: 'stretch'
};

const recordVideoPanelShellSx = {
  width: '100%',
  mx: 'auto',
  bgcolor: COLOR_TEMPLATE7_POPUP_PANEL_BG,
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 1,
  p: { xs: 1.25, sm: 1.5 },
  boxSizing: 'border-box'
};

function applyMicEnabledToStream(stream, enabled) {
  if (!stream) return;
  for (const track of stream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

function pickVideoMimeType({ includeAudio = false } = {}) {
  const candidates = includeAudio
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ]
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

function normalizeVideoDataUrl(dataUrl) {
  const raw = String(dataUrl ?? '').trim();
  const marker = ';base64,';
  const base64Index = raw.indexOf(marker);
  if (!raw.startsWith('data:') || base64Index === -1) return raw;
  const meta = raw.slice(5, base64Index).trim();
  const base64 = raw.slice(base64Index + marker.length).trim();
  const contentType = meta.split(';')[0].trim().toLowerCase() || 'video/webm';
  return `data:${contentType};base64,${base64}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(normalizeVideoDataUrl(String(reader.result || '')));
    reader.onerror = () => reject(reader.error || new Error('Failed to read video'));
    reader.readAsDataURL(blob);
  });
}

function TurnDirectionBanner({ direction }) {
  const word = direction === 'left' ? 'left' : 'right';
  return (
    <Box sx={{ ...getLiveFaceScanScriptBannerFrameSx(), ...scriptBannerTextSx, bgcolor: '#ffffff' }}>
      <Box component="p" sx={{ m: 0, width: '100%', textAlign: 'center' }}>
        Now please turn to{' '}
        <Box component="span" sx={{ color: '#ff0000', fontWeight: 900 }}>
          {word}
        </Box>{' '}
        for few seconds
      </Box>
    </Box>
  );
}

TurnDirectionBanner.propTypes = {
  direction: PropTypes.oneOf(['left', 'right']).isRequired
};

function getScriptPhraseFontSizeSx(phrase) {
  const len = String(phrase ?? '').length;
  if (len <= 55) {
    return { xs: '5.4vw', sm: '2.75vw' };
  }
  if (len <= 75) {
    return { xs: '4.5vw', sm: '2.3vw' };
  }
  if (len <= 95) {
    return { xs: '3.7vw', sm: '1.95vw' };
  }
  return { xs: '3.1vw', sm: '1.6vw' };
}

const scriptBannerHeaderSx = {
  bgcolor: '#e53935',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: scriptBannerFontSizeSx,
  lineHeight: 1.3,
  px: { xs: 1.5, sm: 2 },
  py: { xs: 0.75, sm: 1 },
  flexShrink: 0
};

const scriptBannerPhraseAreaSx = {
  flex: 1,
  minHeight: 0,
  bgcolor: '#ffd84d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: { xs: 1.25, sm: 1.5 },
  py: { xs: 0.5, sm: 0.75 },
  overflow: 'hidden',
  boxSizing: 'border-box'
};

function ScriptPhaseBanner({ scriptPhrase }) {
  return (
    <Box
      sx={{
        ...getLiveFaceScanScriptBannerFrameSx(),
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        p: 0
      }}
    >
      <Box sx={scriptBannerHeaderSx}>Please read this greeting out loud:</Box>
      <Box sx={scriptBannerPhraseAreaSx}>
        <Box
          component="span"
          sx={{
            fontWeight: 900,
            color: '#000000 !important',
            WebkitTextFillColor: '#000000 !important',
            textAlign: 'center',
            lineHeight: 1.1,
            fontSize: getScriptPhraseFontSizeSx(scriptPhrase),
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            width: '100%'
          }}
        >
          {scriptPhrase}
        </Box>
      </Box>
    </Box>
  );
}

ScriptPhaseBanner.propTypes = {
  scriptPhrase: PropTypes.string.isRequired
};

const LIVE_SCAN_DONE_MESSAGE =
  'You can review and rerecord if you wish. Click Save and our team will manual verify latest record video in place for live scan.';

function DonePhaseBanner() {
  return (
    <Box sx={{ ...getLiveFaceScanScriptBannerFrameSx(), ...scriptBannerTextSx, bgcolor: '#ffffff', fontWeight: 600 }}>
      {LIVE_SCAN_DONE_MESSAGE}
    </Box>
  );
}

function RecordingStatusLabel({ mode, overlay = false }) {
  if (!mode) return null;

  const isRecording = mode === 'recording';

  return (
    <Box
      aria-live="polite"
      sx={{
        ...recordingStatusLabelSx,
        ...(overlay ? recordingStatusOverlaySx : null),
        color: isRecording ? '#ff0000' : '#ffd84d',
        WebkitTextFillColor: isRecording ? '#ff0000' : '#ffd84d',
        ...(isRecording
          ? {
              '@keyframes liveFaceScanRecordingBlink': {
                '0%, 49%': { opacity: 1 },
                '50%, 100%': { opacity: 0.2 }
              },
              animation: 'liveFaceScanRecordingBlink 1s step-start infinite'
            }
          : null)
      }}
    >
      {isRecording ? 'Recording' : 'Done'}
    </Box>
  );
}

RecordingStatusLabel.propTypes = {
  mode: PropTypes.oneOf(['recording', 'done']),
  overlay: PropTypes.bool
};

export default function LiveFaceScanVideoFallback({
  firstName,
  fullNameSigned,
  viewerApprovedId,
  onSent,
  onRecordingDone,
  onRecordingCleared,
  onError
}) {
  const cameraVideoRef = useRef(null);
  const playbackVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const phaseTimeoutsRef = useRef([]);
  const recordedBlobUrlRef = useRef('');
  const reviewVideoBlobRef = useRef('');
  const autoSendBlobRef = useRef(null);
  const scriptPhraseRef = useRef('');
  const micEnabledRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [micEnabled, setMicEnabled] = useState(false);
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [countdownSecondsLeft, setCountdownSecondsLeft] = useState(null);
  const [scriptPhrase, setScriptPhrase] = useState('');
  const [recordedBlobUrl, setRecordedBlobUrl] = useState('');
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedConsentMediaId, setSavedConsentMediaId] = useState(null);
  const [savedConsentMediaUrl, setSavedConsentMediaUrl] = useState('');
  const [reviewVideoOpen, setReviewVideoOpen] = useState(false);
  const [reviewVideoUrl, setReviewVideoUrl] = useState('');
  const [reviewVideoLoading, setReviewVideoLoading] = useState(false);
  const [reviewVideoError, setReviewVideoError] = useState('');
  const [micRequiredOpen, setMicRequiredOpen] = useState(false);
  const [statusText, setStatusText] = useState('');

  const playbackVideoUrl = recordedBlobUrl || savedConsentMediaUrl;
  const canReviewVideo = sent && (Boolean(recordedBlobUrl) || Number(savedConsentMediaId) > 0);

  const sessionActive = phase !== PHASE.IDLE;
  const countingDown = phase === PHASE.COUNTDOWN;
  const recording = phase === PHASE.SCRIPT || phase === PHASE.TURN_LEFT || phase === PHASE.TURN_RIGHT || phase === PHASE.DONE;
  const recordingDone = Boolean(recordedBlobUrl) && phase === PHASE.IDLE;

  const isMicrophoneReady = useCallback(() => {
    if (!micEnabledRef.current) return false;
    const audioTracks = streamRef.current?.getAudioTracks() ?? [];
    if (audioTracks.length === 0) return false;
    applyMicEnabledToStream(streamRef.current, true);
    return audioTracks.some((track) => track.readyState !== 'ended');
  }, []);

  const revokeReviewVideoBlob = useCallback(() => {
    if (reviewVideoBlobRef.current) {
      URL.revokeObjectURL(reviewVideoBlobRef.current);
      reviewVideoBlobRef.current = '';
    }
  }, []);

  const closeReviewVideo = useCallback(() => {
    revokeReviewVideoBlob();
    setReviewVideoOpen(false);
    setReviewVideoUrl('');
    setReviewVideoError('');
    setReviewVideoLoading(false);
  }, [revokeReviewVideoBlob]);

  const attachStreamToCamera = useCallback(async () => {
    if (!cameraVideoRef.current || !streamRef.current) return;
    cameraVideoRef.current.srcObject = streamRef.current;
    await cameraVideoRef.current.play().catch(() => {});
  }, []);

  const clearPhaseTimeouts = useCallback(() => {
    for (const id of phaseTimeoutsRef.current) {
      clearTimeout(id);
    }
    phaseTimeoutsRef.current = [];
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

  const revokeRecordedUrl = useCallback(() => {
    if (recordedBlobUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current);
      recordedBlobUrlRef.current = '';
    }
  }, []);

  const schedulePhase = useCallback((delayMs, nextPhase) => {
    const id = setTimeout(() => {
      setPhase(nextPhase);
    }, delayMs);
    phaseTimeoutsRef.current.push(id);
  }, []);

  const startCamera = useCallback(async ({ withAudio = false } = {}) => {
    setCameraError('');
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      setCameraReady(false);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: withAudio
      });
      applyMicEnabledToStream(stream, withAudio);
      streamRef.current = stream;
      setCameraReady(true);
      await attachStreamToCamera();
      return true;
    } catch (err) {
      setCameraError(
        sanitizeUserFacingTechTerms(
          err?.message ||
            (withAudio ? 'Could not access the microphone.' : 'Could not access the camera.')
        )
      );
      setCameraReady(false);
      return false;
    }
  }, [attachStreamToCamera, stopStream]);

  const enableMicrophone = useCallback(async () => {
    if (!streamRef.current) {
      micEnabledRef.current = true;
      const ok = await startCamera({ withAudio: true });
      if (!ok) {
        micEnabledRef.current = false;
        setMicEnabled(false);
        return false;
      }
      applyMicEnabledToStream(streamRef.current, true);
      setMicEnabled(true);
      return true;
    }

    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of audioStream.getAudioTracks()) {
          streamRef.current.addTrack(track);
        }
      } catch (err) {
        setCameraError(sanitizeUserFacingTechTerms(err?.message || 'Could not access the microphone.'));
        return false;
      }
    }

    applyMicEnabledToStream(streamRef.current, true);
    micEnabledRef.current = true;
    setMicEnabled(true);
    return true;
  }, [startCamera]);

  const disableMicrophone = useCallback(() => {
    micEnabledRef.current = false;
    setMicEnabled(false);
    applyMicEnabledToStream(streamRef.current, false);
  }, []);

  useEffect(() => {
    return () => {
      clearPhaseTimeouts();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      stopStream();
      revokeRecordedUrl();
      revokeReviewVideoBlob();
    };
  }, [stopStream, clearPhaseTimeouts, revokeRecordedUrl, revokeReviewVideoBlob]);

  useEffect(() => {
    if ((sessionActive || replaying === false) && cameraReady && !replaying) {
      void attachStreamToCamera();
    }
  }, [sessionActive, cameraReady, attachStreamToCamera, replaying]);

  useEffect(() => {
    if (!replaying || !playbackVideoUrl) return undefined;
    const playback = playbackVideoRef.current;
    if (!playback) return undefined;
    playback.src = playbackVideoUrl;
    playback.load();
    playback.currentTime = 0;
    let cancelled = false;
    const startPlayback = () => {
      if (cancelled) return;
      void playback.play().catch(() => {
        if (!cancelled) {
          setStatusText('Could not play recording. Click Record to try again.');
          setReplaying(false);
        }
      });
    };
    if (playback.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      playback.addEventListener('loadeddata', startPlayback, { once: true });
    }
    return () => {
      cancelled = true;
      playback.removeEventListener('loadeddata', startPlayback);
    };
  }, [replaying, playbackVideoUrl]);

  const finishRecording = useCallback(
    (blob) => {
      clearPhaseTimeouts();
      setPhase(PHASE.IDLE);
      setCountdownSecondsLeft(null);
      if (!blob || !blob.size) {
        setStatusText('Recording failed. Click Record to try again.');
        return;
      }
      revokeRecordedUrl();
      const url = URL.createObjectURL(blob);
      recordedBlobUrlRef.current = url;
      setRecordedBlobUrl(url);
      setRecordedBlob(blob);
      setReplaying(false);
      setStatusText('');
      onRecordingDone?.();
    },
    [clearPhaseTimeouts, onRecordingDone, revokeRecordedUrl]
  );

  const stopActiveRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const beginScriptedRecording = useCallback(() => {
    if (!streamRef.current) return;

    stopActiveRecording();
    clearPhaseTimeouts();
    revokeRecordedUrl();
    setRecordedBlobUrl('');
    setRecordedBlob(null);
    setReplaying(false);
    setSent(false);
    setSavedConsentMediaId(null);
    setSavedConsentMediaUrl('');
    setStatusText('');
    autoSendBlobRef.current = null;
    onRecordingCleared?.();

    const phrase = pickRandomLiveFaceScanScriptPhrase(firstName);
    scriptPhraseRef.current = phrase;
    setScriptPhrase(phrase);

    chunksRef.current = [];
    const mimeType = pickVideoMimeType({ includeAudio: micEnabledRef.current });
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, { mimeType });
    } catch (err) {
      setPhase(PHASE.IDLE);
      setStatusText(sanitizeUserFacingTechTerms(err?.message || 'Could not start video recording.'));
      onError?.(err);
      return;
    }

    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
      finishRecording(blob);
    };
    recorder.onerror = () => {
      clearPhaseTimeouts();
      setPhase(PHASE.IDLE);
      setStatusText('Recording error. Click Record to try again.');
    };

    recorder.start(1000);
    setPhase(PHASE.SCRIPT);
    void attachStreamToCamera();

    schedulePhase(SCRIPT_SECONDS * 1000, PHASE.TURN_LEFT);
    schedulePhase((SCRIPT_SECONDS + TURN_LEFT_SECONDS) * 1000, PHASE.TURN_RIGHT);
    schedulePhase((SCRIPT_SECONDS + TURN_LEFT_SECONDS + TURN_RIGHT_SECONDS) * 1000, PHASE.DONE);
    phaseTimeoutsRef.current.push(
      setTimeout(() => {
        stopActiveRecording();
      }, (SCRIPT_SECONDS + TURN_LEFT_SECONDS + TURN_RIGHT_SECONDS + DONE_SECONDS) * 1000)
    );
  }, [
    attachStreamToCamera,
    clearPhaseTimeouts,
    finishRecording,
    firstName,
    onError,
    onRecordingCleared,
    revokeRecordedUrl,
    schedulePhase,
    stopActiveRecording
  ]);

  const startCountdown = useCallback(() => {
    if (!streamRef.current) return;

    stopActiveRecording();
    clearPhaseTimeouts();
    revokeRecordedUrl();
    setRecordedBlobUrl('');
    setRecordedBlob(null);
    setReplaying(false);
    setSent(false);
    setSavedConsentMediaId(null);
    setSavedConsentMediaUrl('');
    setStatusText('');
    setScriptPhrase('');
    onRecordingCleared?.();

    let remaining = COUNTDOWN_SECONDS;
    setPhase(PHASE.COUNTDOWN);
    setCountdownSecondsLeft(remaining);
    void attachStreamToCamera();

    const intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownSecondsLeft(remaining);
        return;
      }
      clearInterval(intervalId);
      setCountdownSecondsLeft(null);
      beginScriptedRecording();
    }, 1000);
    phaseTimeoutsRef.current.push(intervalId);
  }, [attachStreamToCamera, beginScriptedRecording, clearPhaseTimeouts, onRecordingCleared, revokeRecordedUrl, stopActiveRecording]);

  const handleRecord = useCallback(async () => {
    if (sessionActive || sending) return;
    if (!isMicrophoneReady()) {
      setMicRequiredOpen(true);
      return;
    }
    if (!streamRef.current) {
      const ok = await startCamera({ withAudio: true });
      if (!ok || !streamRef.current) return;
      if (!isMicrophoneReady()) {
        setMicRequiredOpen(true);
        return;
      }
      startCountdown();
      return;
    }
    startCountdown();
  }, [sessionActive, sending, isMicrophoneReady, startCamera, startCountdown]);

  const handleReviewVideo = useCallback(async () => {
    if (sessionActive || sending || !sent || !canReviewVideo) return;

    revokeReviewVideoBlob();
    setReviewVideoUrl('');
    setReviewVideoError('');
    setReviewVideoOpen(true);
    setReviewVideoLoading(true);

    try {
      if (recordedBlobUrl) {
        setReviewVideoUrl(recordedBlobUrl);
        return;
      }
      const blobUrl = await fetchConsentVideoObjectUrl(savedConsentMediaId);
      reviewVideoBlobRef.current = blobUrl;
      setReviewVideoUrl(blobUrl);
    } catch (err) {
      setReviewVideoError(sanitizeUserFacingTechTerms(err?.message || 'Failed to load video.'));
      onError?.(err);
    } finally {
      setReviewVideoLoading(false);
    }
  }, [
    canReviewVideo,
    onError,
    recordedBlobUrl,
    savedConsentMediaId,
    sent,
    sending,
    sessionActive
  ]);

  const handleToggleMic = useCallback(async () => {
    if (micEnabled) {
      disableMicrophone();
      return;
    }
    await enableMicrophone();
  }, [disableMicrophone, enableMicrophone, micEnabled]);

  const handleSend = useCallback(async () => {
    if (!recordedBlob || sending || sessionActive) return false;
    if (!fullNameSigned?.trim()) {
      autoSendBlobRef.current = null;
      setStatusText('Enter your legal name on Step 1 before sending.');
      return false;
    }
    if (!viewerApprovedId) {
      autoSendBlobRef.current = null;
      setStatusText('Sign in is required before sending.');
      return false;
    }

    setSending(true);
    setStatusText('');
    try {
      const consentVideo = await blobToDataUrl(recordedBlob);
      if (!consentVideo.startsWith('data:') || !consentVideo.includes(';base64,')) {
        throw new Error('Could not prepare video for upload. Click Record and try again.');
      }
      const saveResult = await postSaveLiveFaceScanVideoConsent({
        full_name_signed: fullNameSigned.trim(),
        viewer_approved: viewerApprovedId,
        consent_video: consentVideo
      });
      const videoId = Number(saveResult?.consent_signature_video_fk);
      if (Number.isFinite(videoId) && videoId > 0) {
        setSavedConsentMediaId(videoId);
        setSavedConsentMediaUrl(consentRecordVideoUrl(videoId));
      }
      setSent(true);
      setStatusText('');
      onSent?.();
      return true;
    } catch (err) {
      autoSendBlobRef.current = null;
      const msg = sanitizeUserFacingTechTerms(err?.message || 'Failed to send video.');
      setStatusText(msg);
      onError?.(err);
      return false;
    } finally {
      setSending(false);
    }
  }, [fullNameSigned, viewerApprovedId, recordedBlob, sending, sessionActive, onSent, onError]);

  useEffect(() => {
    if (!recordingDone || !recordedBlob || sent || sending || sessionActive) return;
    if (autoSendBlobRef.current === recordedBlob) return;
    autoSendBlobRef.current = recordedBlob;
    void handleSend();
  }, [recordingDone, recordedBlob, sent, sending, sessionActive, handleSend]);

  const banner = useMemo(() => {
    if (phase === PHASE.SCRIPT && scriptPhrase) {
      return <ScriptPhaseBanner scriptPhrase={scriptPhrase} />;
    }
    if (phase === PHASE.TURN_LEFT) {
      return <TurnDirectionBanner direction="left" />;
    }
    if (phase === PHASE.TURN_RIGHT) {
      return <TurnDirectionBanner direction="right" />;
    }
    if (phase === PHASE.DONE) {
      return <DonePhaseBanner />;
    }
    if (recordingDone && !replaying) {
      return <DonePhaseBanner />;
    }
    return null;
  }, [phase, scriptPhrase, recordingDone, replaying]);

  const recordButtonLabel =
    countingDown && countdownSecondsLeft != null ? `Record Video (${countdownSecondsLeft})` : 'Record Video';
  const showLiveCamera = !replaying;

  return (
    <Box sx={liveFaceScanFallbackRootSx}>
      <Box sx={recordVideoPanelShellSx}>
      <Stack spacing={1.5} sx={{ width: '100%', alignItems: 'stretch' }}>
      <Box sx={liveScanVideoControlsColumnSx}>
      {banner ? <Box sx={{ width: '100%' }}>{banner}</Box> : null}

      <Stack
        direction="column"
        spacing={1.25}
        sx={{ ...getLiveFaceScanRecordVideoControlWidthSx(), alignItems: 'center' }}
      >
        <ColorTemplate7PopupLargeDark.ActionButton
          type="button"
          sx={liveScanVideoButtonFitSx}
          onClick={() => void handleRecord()}
          disabled={sending || sessionActive}
        >
          {recordButtonLabel}
        </ColorTemplate7PopupLargeDark.ActionButton>
      </Stack>

      <Box sx={getLiveFaceScanRecordVideoControlWidthSx()}>
        <Box sx={videoPanelSx} data-idv-capture-skip="true">
        {showLiveCamera ? (
          <Box
            component="video"
            ref={cameraVideoRef}
            autoPlay
            muted
            playsInline
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            component="video"
            ref={playbackVideoRef}
            controls={false}
            playsInline
            onEnded={() => setReplaying(false)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {countingDown && countdownSecondsLeft != null ? (
          <Box sx={countdownCenterSx} aria-live="polite">
            {countdownSecondsLeft}
          </Box>
        ) : null}
        {recording ? <RecordingStatusLabel mode="recording" overlay /> : null}
        <IconButton
          type="button"
          aria-label={micEnabled ? 'Turn microphone off' : 'Turn microphone on'}
          aria-pressed={micEnabled}
          onClick={() => void handleToggleMic()}
          disabled={sending || sessionActive}
          sx={{
            ...micToggleButtonSx,
            bgcolor: micEnabled ? '#43a047' : '#e53935',
            color: '#ffffff',
            '@media (hover: hover)': {
              '&:hover': {
                transform: getHoverEnlargeTransform(),
                bgcolor: micEnabled ? '#388e3c' : '#c62828'
              }
            },
            '&.Mui-disabled': {
              bgcolor: 'rgba(67, 160, 71, 0.45)',
              color: '#ffffff'
            }
          }}
        >
          {micEnabled ? <MicIcon sx={{ fontSize: 28 }} /> : <MicOffIcon sx={{ fontSize: 28 }} />}
        </IconButton>
        </Box>
      </Box>

      {recordingDone && sending ? (
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', width: '100%' }}>
          Sending for processing…
        </ColorTemplate7PopupLargeDark.BodyText>
      ) : null}
      {recordingDone && !sent && !sending ? (
        <ColorTemplate7PopupLargeDark.ActionButton
          type="button"
          sx={liveScanVideoButtonFitSx}
          onClick={() => void handleSend()}
          disabled={!recordedBlob || sessionActive}
        >
          Send for Processing
        </ColorTemplate7PopupLargeDark.ActionButton>
      ) : null}

      {cameraError ? (
        <ColorTemplate7PopupLargeDark.ErrorBar sx={{ width: '100%', textAlign: 'center' }}>
          {cameraError}
        </ColorTemplate7PopupLargeDark.ErrorBar>
      ) : null}
      {recordingDone && statusText && !sent ? (
        <ColorTemplate7PopupLargeDark.BodyText
          sx={{
            textAlign: 'center',
            width: '100%'
          }}
        >
          {statusText}
        </ColorTemplate7PopupLargeDark.BodyText>
      ) : null}
      {recordingDone ? (
        <ColorTemplate7PopupLargeDark.ActionButton
          type="button"
          sx={liveScanVideoButtonFitSx}
          onClick={() => void handleReviewVideo()}
          disabled={!canReviewVideo || sessionActive || sending || reviewVideoLoading}
        >
          Review Video
        </ColorTemplate7PopupLargeDark.ActionButton>
      ) : null}
      </Box>

      </Stack>
      </Box>
      <ColorTemplate7PopupLargeDark
        open={micRequiredOpen}
        onClose={() => setMicRequiredOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close microphone required message"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
            Turn on the microphone before recording.
          </ColorTemplate7PopupLargeDark.BodyText>
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>
            Tap the microphone button on the video preview to turn it on, then click Record Video again.
          </ColorTemplate7PopupLargeDark.BodyText>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={() => setMicRequiredOpen(false)}>
              OK
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Box>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
      <ColorTemplate7PopupLargeDark
        open={reviewVideoOpen}
        onClose={closeReviewVideo}
        closeOnBackdrop
        closeButtonAriaLabel="Close review video player"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1}>
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
            Review Video
          </ColorTemplate7PopupLargeDark.BodyText>
          {reviewVideoLoading ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading video…</ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {reviewVideoError ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {reviewVideoError}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {reviewVideoUrl ? (
            <Box
              component="video"
              src={reviewVideoUrl}
              controls
              autoPlay
              playsInline
              sx={{ width: '100%', maxHeight: '70vh' }}
            />
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </Box>
  );
}

LiveFaceScanVideoFallback.propTypes = {
  firstName: PropTypes.string,
  fullNameSigned: PropTypes.string,
  viewerApprovedId: PropTypes.number,
  onSent: PropTypes.func,
  onRecordingDone: PropTypes.func,
  onRecordingCleared: PropTypes.func,
  onError: PropTypes.func
};
