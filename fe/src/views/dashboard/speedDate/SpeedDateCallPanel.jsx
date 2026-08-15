import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import useSpeedDateWebRtc from 'hooks/useSpeedDateWebRtc';

function VideoPane({ stream, muted, label, mirror }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.srcObject = stream || null;
    const play = () => {
      el.play()?.catch(() => {});
    };
    play();
    const videoTrack = stream?.getVideoTracks?.()?.[0] || null;
    videoTrack?.addEventListener('unmute', play);
    videoTrack?.addEventListener('ended', play);
    return () => {
      videoTrack?.removeEventListener('unmute', play);
      videoTrack?.removeEventListener('ended', play);
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 220, bgcolor: '#111', borderRadius: 2, overflow: 'hidden' }}>
      <Box
        component="video"
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none'
        }}
      />
      <Typography
        sx={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          color: '#fff',
          bgcolor: 'rgba(0,0,0,0.45)',
          px: 1,
          borderRadius: 1,
          fontSize: '0.85rem'
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

VideoPane.propTypes = {
  stream: PropTypes.object,
  muted: PropTypes.bool,
  label: PropTypes.string,
  mirror: PropTypes.bool
};

export default function SpeedDateCallPanel({ pairId, isOfferer, iceServers, partnerLabel }) {
  const {
    localStream,
    remoteStream,
    status,
    error,
    muted,
    cameraOff,
    cameras,
    cameraId,
    toggleMute,
    toggleCamera,
    switchCamera,
    requestCameras
  } = useSpeedDateWebRtc({
    pairId,
    isOfferer,
    iceServers,
    enabled: Boolean(pairId)
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const restoreCameraIdRef = useRef('');

  const openCameraPicker = async () => {
    restoreCameraIdRef.current = cameraId;
    setPickerOpen(true);
    setPickerBusy(true);
    try {
      await requestCameras();
    } finally {
      setPickerBusy(false);
    }
  };

  const previewCamera = async (id) => {
    if (!id || pickerBusy) return;
    setPickerBusy(true);
    try {
      await switchCamera(id, { force: true });
    } finally {
      setPickerBusy(false);
    }
  };

  const closePicker = async (restore) => {
    const previous = restoreCameraIdRef.current;
    setPickerOpen(false);
    if (restore && previous && previous !== cameraId) {
      setPickerBusy(true);
      try {
        await switchCamera(previous, { force: true });
      } finally {
        setPickerBusy(false);
      }
    }
  };

  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ minHeight: 280 }}>
        <VideoPane stream={remoteStream} muted={false} label={partnerLabel || 'Partner'} />
        <VideoPane stream={localStream} muted label={cameraOff ? 'You (camera off)' : 'You'} mirror />
      </Stack>
      <Typography sx={{ color: 'var(--theme-primary-color)' }}>
        {error || (status === 'connected' ? 'Live (SD 640×480)' : `Video: ${status}`)}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <UnSelectedButtonTemplate onClick={() => void openCameraPicker()}>Choose camera</UnSelectedButtonTemplate>
        <UnSelectedButtonTemplate onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</UnSelectedButtonTemplate>
        <UnSelectedButtonTemplate onClick={toggleCamera}>{cameraOff ? 'Camera on' : 'Camera off'}</UnSelectedButtonTemplate>
      </Stack>

      <ColorTemplate7PopupLargeDark
        open={pickerOpen}
        showCloseButton
        closeOnBackdrop={false}
        centerInWindow
        maxWidth="520px"
        onClose={() => void closePicker(true)}
        closeButtonAriaLabel="Close camera selection"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>Choose camera</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>
            Click a camera to preview it. In two browser windows on this Mac, each window must pick a different camera — the other window is already using one of them.
          </ColorTemplate7PopupLargeDark.BodyText>
          <Box
            sx={{
              width: '100%',
              minHeight: 220,
              bgcolor: '#111',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <VideoPane stream={localStream} muted label="Preview" mirror />
          </Box>
          <Stack spacing={1}>
            {cameras.length ? (
              cameras.map((cam) => {
                const selected = cam.deviceId === cameraId;
                const Button = selected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
                return (
                  <Button
                    key={cam.deviceId}
                    fullWidth
                    disabled={pickerBusy}
                    onClick={() => void previewCamera(cam.deviceId)}
                  >
                    {cam.label}
                  </Button>
                );
              })
            ) : (
              <Stack spacing={1}>
                <ColorTemplate7PopupLargeDark.BodyText>
                  No cameras listed yet. Allow camera access in this window, then pick the camera the other window is not using.
                </ColorTemplate7PopupLargeDark.BodyText>
                <UnSelectedButtonTemplate
                  disabled={pickerBusy}
                  onClick={async () => {
                    setPickerBusy(true);
                    try {
                      await requestCameras();
                    } finally {
                      setPickerBusy(false);
                    }
                  }}
                >
                  Allow cameras
                </UnSelectedButtonTemplate>
              </Stack>
            )}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
            <UnSelectedButtonTemplate onClick={() => void closePicker(true)}>Cancel</UnSelectedButtonTemplate>
            <ColorTemplate7PopupLargeDark.ActionButton onClick={() => void closePicker(false)}>
              Use this camera
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </Stack>
  );
}

SpeedDateCallPanel.propTypes = {
  pairId: PropTypes.number,
  isOfferer: PropTypes.bool,
  iceServers: PropTypes.array,
  partnerLabel: PropTypes.string
};
