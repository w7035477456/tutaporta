import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSpeedDateSignals, postSpeedDateSignal } from 'api/speedDateFe';

const CAMERA_STORE_KEY = 'vsingles.speedDate.cameraId';
const CAMERA_RELEASE_MS = 200;
const SEND_MAX_BITRATE = 600000;

function loadStoredCameraId() {
  try {
    return String(window.sessionStorage.getItem(CAMERA_STORE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function saveStoredCameraId(id) {
  try {
    const next = String(id || '').trim();
    if (next) window.sessionStorage.setItem(CAMERA_STORE_KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function mediaErrorMessage(err, fallback) {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera or microphone permission was blocked.';
  }
  if (name === 'NotFoundError' || /object can not be found/i.test(msg)) {
    return 'That camera is already in use, often by the other browser window. Choose the other camera.';
  }
  if (name === 'OverconstrainedError') {
    return 'That camera could not use these video settings. Try another camera.';
  }
  return msg || fallback || 'Could not open camera.';
}

function audioConstraints() {
  return { echoCancellation: true, noiseSuppression: true };
}

async function getUserMediaWithFallback(attempts) {
  let lastErr;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Camera or microphone permission was blocked.');
}

function videoAttempts(cameraId, withAudio) {
  const id = String(cameraId || '').trim();
  const audio = withAudio ? audioConstraints() : false;
  if (id) {
    return [
      { audio, video: { deviceId: { exact: id } } },
      { audio, video: { deviceId: { ideal: id } } }
    ];
  }
  return [
    {
      audio,
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
    },
    { audio, video: true }
  ];
}

async function listVideoInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'videoinput' && d.deviceId)
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: String(d.label || '').trim() || `Camera ${i + 1}`
    }));
}

function orderCameras(list, preferredId) {
  const preferred = String(preferredId || '').trim();
  if (!preferred) return list;
  return [
    ...list.filter((d) => d.deviceId === preferred),
    ...list.filter((d) => d.deviceId !== preferred)
  ];
}

async function promptForDeviceLabels() {
  const attempts = [
    { audio: audioConstraints(), video: { facingMode: { ideal: 'user' } } },
    { audio: audioConstraints(), video: true },
    { audio: true }
  ];
  for (const constraints of attempts) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia(constraints);
      tmp.getTracks().forEach((t) => t.stop());
      await sleep(CAMERA_RELEASE_MS);
      return true;
    } catch {
      /* try next — USB may already be in use by the other window */
    }
  }
  return false;
}

async function openAnyCamera(preferredId, withAudio) {
  let list = await listVideoInputs();
  if (!list.length) {
    await promptForDeviceLabels();
    list = await listVideoInputs();
  }
  let lastErr;
  for (const cam of orderCameras(list, preferredId)) {
    try {
      return await getUserMediaWithFallback(videoAttempts(cam.deviceId, withAudio));
    } catch (err) {
      lastErr = err;
    }
  }
  const audio = withAudio ? audioConstraints() : false;
  try {
    return await getUserMediaWithFallback([
      { audio, video: { facingMode: { ideal: 'user' } } },
      ...videoAttempts('', withAudio)
    ]);
  } catch (err) {
    throw lastErr || err;
  }
}

async function applyPreferredSize(track) {
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 }
    });
  } catch {
    /* USB cameras often only expose 720p/1080p; keep the mode that opened. */
  }
}

async function limitSendQuality(sender) {
  if (!sender?.getParameters || !sender?.setParameters) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = SEND_MAX_BITRATE;
    const width = Number(sender.track?.getSettings?.()?.width) || 0;
    if (width > 640) {
      params.encodings[0].scaleResolutionDownBy = Math.max(1, width / 640);
    }
    await sender.setParameters(params);
  } catch {
    /* encoders may reject scale; sending native size is still a working call. */
  }
}

function iceServersFromSession(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }
  return raw;
}

export default function useSpeedDateWebRtc({ pairId, isOfferer, iceServers, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState(() => loadStoredCameraId());

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const cameraIdRef = useRef(cameraId);
  const videoSenderRef = useRef(null);
  const afterIdRef = useRef(0);
  const makingOfferRef = useRef(false);
  const pendingIceRef = useRef([]);
  const switchingRef = useRef(false);

  cameraIdRef.current = cameraId;

  const publishLocalTracks = useCallback((stream) => {
    localRef.current = stream;
    setLocalStream(stream ? new MediaStream(stream.getTracks()) : null);
  }, []);

  const stopAll = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    videoSenderRef.current = null;
    localRef.current?.getTracks()?.forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    afterIdRef.current = 0;
    pendingIceRef.current = [];
  }, []);

  const applyIce = useCallback(async (pc, candidate) => {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (pc.signalingState !== 'closed') {
        console.warn('[speed-date] addIceCandidate', err);
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks()?.forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localRef.current?.getVideoTracks()?.forEach((t) => {
      t.enabled = !next;
    });
    setCameraOff(next);
  }, [cameraOff]);

  const refreshCameras = useCallback(async (preferredId) => {
    const list = await listVideoInputs();
    setCameras(list);
    if (preferredId && list.some((d) => d.deviceId === preferredId)) {
      setCameraId(preferredId);
      saveStoredCameraId(preferredId);
      return list;
    }
    const currentTrackId = localRef.current?.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
    if (currentTrackId && list.some((d) => d.deviceId === currentTrackId)) {
      setCameraId(currentTrackId);
      saveStoredCameraId(currentTrackId);
    } else if (list[0]?.deviceId && !cameraIdRef.current) {
      setCameraId(list[0].deviceId);
    }
    return list;
  }, []);

  const attachVideoTrack = useCallback(
    async (newTrack, { stopOld = true } = {}) => {
      const pc = pcRef.current;
      const local = localRef.current;
      const oldVideo = local?.getVideoTracks?.()?.[0] || null;
      const sender =
        videoSenderRef.current || pc?.getSenders?.()?.find((s) => s.track?.kind === 'video') || null;

      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
        videoSenderRef.current = sender;
        await limitSendQuality(sender);
      }

      if (newTrack && local) {
        if (oldVideo && oldVideo !== newTrack) {
          try {
            local.removeTrack(oldVideo);
          } catch {
            /* already removed */
          }
          if (stopOld) oldVideo.stop();
        }
        local.addTrack(newTrack);
        publishLocalTracks(local);
      } else if (newTrack) {
        publishLocalTracks(new MediaStream([newTrack]));
      }

      const usedId = newTrack?.getSettings?.()?.deviceId || '';
      if (usedId) {
        cameraIdRef.current = usedId;
        setCameraId(usedId);
        saveStoredCameraId(usedId);
      }
      setCameraOff(false);
    },
    [publishLocalTracks]
  );

  const switchCamera = useCallback(
    async (nextId, { force = false } = {}) => {
      const id = String(nextId ?? '').trim();
      if (!force && id && id === cameraIdRef.current) return true;
      if (switchingRef.current) return false;
      switchingRef.current = true;

      const previousId = cameraIdRef.current;
      const oldVideo = localRef.current?.getVideoTracks?.()?.[0] || null;
      if (oldVideo) {
        try {
          localRef.current?.removeTrack?.(oldVideo);
        } catch {
          /* already removed */
        }
        oldVideo.stop();
        publishLocalTracks(localRef.current);
        await sleep(CAMERA_RELEASE_MS);
      }

      try {
        const newStream = await getUserMediaWithFallback(videoAttempts(id, false));
        const newTrack = newStream.getVideoTracks()[0];
        newStream.getAudioTracks().forEach((t) => t.stop());
        if (!newTrack) throw new Error('That camera did not return video.');
        await applyPreferredSize(newTrack);
        await attachVideoTrack(newTrack, { stopOld: false });
        setError('');
        await refreshCameras(newTrack.getSettings?.()?.deviceId || id);
        return true;
      } catch (err) {
        setError(mediaErrorMessage(err, 'Could not switch to that camera.'));
        if (previousId && previousId !== id) {
          try {
            const restore = await getUserMediaWithFallback(videoAttempts(previousId, false));
            const restoreTrack = restore.getVideoTracks()[0];
            restore.getAudioTracks().forEach((t) => t.stop());
            if (restoreTrack) {
              await applyPreferredSize(restoreTrack);
              await attachVideoTrack(restoreTrack, { stopOld: false });
            }
          } catch {
            /* keep the error from the camera the user asked for */
          }
        }
        return false;
      } finally {
        switchingRef.current = false;
      }
    },
    [attachVideoTrack, publishLocalTracks, refreshCameras]
  );

  const requestCameras = useCallback(async () => {
    let list = await listVideoInputs();
    if (!list.length) {
      await promptForDeviceLabels();
      list = await listVideoInputs();
      setCameras(list);
    }
    if (!localRef.current?.getVideoTracks?.()?.length) {
      try {
        const needAudio = !localRef.current?.getAudioTracks?.()?.length;
        const stream = await openAnyCamera(cameraIdRef.current, needAudio);
        const videoTrack = stream.getVideoTracks()[0];
        if (needAudio) {
          localRef.current = stream;
          publishLocalTracks(stream);
          const sender = videoSenderRef.current;
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
            await limitSendQuality(sender);
          }
        } else if (videoTrack) {
          stream.getAudioTracks().forEach((t) => t.stop());
          await applyPreferredSize(videoTrack);
          await attachVideoTrack(videoTrack, { stopOld: false });
        }
        setError('');
      } catch (err) {
        setError(mediaErrorMessage(err, 'Could not open a camera.'));
      }
    }
    return refreshCameras(localRef.current?.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId);
  }, [attachVideoTrack, publishLocalTracks, refreshCameras]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return undefined;
    const onChange = () => {
      refreshCameras(cameraIdRef.current).catch(() => {});
    };
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [refreshCameras]);

  const iceKey = JSON.stringify(iceServers ?? []);

  useEffect(() => {
    if (!enabled || !pairId) {
      stopAll();
      return undefined;
    }

    let cancelled = false;
    const remote = new MediaStream();
    let parsedIce = [];
    try {
      parsedIce = JSON.parse(iceKey);
    } catch {
      parsedIce = [];
    }

    async function start() {
      setError('');
      setStatus('camera');
      let stream = null;
      try {
        stream = await openAnyCamera(cameraIdRef.current, true);
      } catch (err) {
        await refreshCameras(cameraIdRef.current);
        setError(mediaErrorMessage(err, 'Camera or microphone permission was blocked.'));
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() });
        } catch {
          stream = null;
        }
      }
      if (cancelled) {
        stream?.getTracks?.()?.forEach((t) => t.stop());
        return;
      }
      const videoTrack = stream?.getVideoTracks?.()?.[0] || null;
      await applyPreferredSize(videoTrack);
      if (stream) {
        localRef.current = stream;
        publishLocalTracks(stream);
      }
      await refreshCameras(videoTrack?.getSettings?.()?.deviceId);

      const pc = new RTCPeerConnection({ iceServers: iceServersFromSession(parsedIce) });
      pcRef.current = pc;
      if (stream) {
        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          if (track.kind === 'video') videoSenderRef.current = sender;
        });
      }
      if (!videoSenderRef.current) {
        videoSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;
      }
      if (!stream?.getAudioTracks?.()?.length) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      await limitSendQuality(videoSenderRef.current);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks()?.forEach((track) => remote.addTrack(track));
        if (!event.streams[0] && event.track) remote.addTrack(event.track);
        setRemoteStream(new MediaStream(remote.getTracks()));
        setStatus('connected');
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || cancelled) return;
        postSpeedDateSignal(pairId, 'ice', event.candidate.toJSON()).catch((err) => {
          console.warn('[speed-date] ice post failed', err);
        });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') setStatus('connected');
        if (state === 'failed') setStatus('error');
        if (state === 'disconnected') setStatus('reconnecting');
      };

      setStatus('connecting');

      if (isOfferer) {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSpeedDateSignal(pairId, 'offer', {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp
        });
        makingOfferRef.current = false;
      }

      const poll = async () => {
        if (cancelled || !pcRef.current) return;
        try {
          const signals = await fetchSpeedDateSignals(pairId, afterIdRef.current);
          for (const signal of signals) {
            afterIdRef.current = Math.max(afterIdRef.current, Number(signal.signal_id) || 0);
            if (signal.kind === 'offer' && signal.payload?.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await postSpeedDateSignal(pairId, 'answer', {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp
              });
              for (const cand of pendingIceRef.current) {
                await applyIce(pc, cand);
              }
              pendingIceRef.current = [];
            } else if (signal.kind === 'answer' && signal.payload?.sdp) {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
                for (const cand of pendingIceRef.current) {
                  await applyIce(pc, cand);
                }
                pendingIceRef.current = [];
              }
            } else if (signal.kind === 'ice' && signal.payload) {
              const candidate = new RTCIceCandidate(signal.payload);
              if (!pc.remoteDescription) {
                pendingIceRef.current.push(candidate);
              } else {
                await applyIce(pc, candidate);
              }
            }
          }
        } catch (err) {
          if (!cancelled) console.warn('[speed-date] signal poll', err);
        }
      };

      await poll();
      const timer = window.setInterval(poll, 400);
      return () => window.clearInterval(timer);
    }

    let clearPoll = () => {};
    start()
      .then((cleanup) => {
        if (typeof cleanup === 'function') clearPoll = cleanup;
      })
      .catch((err) => {
        if (!cancelled) {
          setError(mediaErrorMessage(err, 'Could not start video call.'));
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      clearPoll();
      stopAll();
    };
  }, [applyIce, enabled, iceKey, isOfferer, pairId, publishLocalTracks, refreshCameras, stopAll]);

  return {
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
    refreshCameras,
    requestCameras
  };
}
