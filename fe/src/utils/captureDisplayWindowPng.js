/**
 * Capture one still PNG of a screen / window / browser tab the user picks.
 * Uses getDisplayMedia (Chrome/Edge/Safari) — cannot grab another window without that picker.
 */

function waitForVideoFrame(video, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Screen capture timed out waiting for a video frame'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function stopStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {{ fileName?: string }} [opts]
 * @returns {Promise<File>} PNG File ready for uploadPaidRecordAttachment
 */
export async function captureDisplayWindowAsPngFile(opts = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser');
  }

  let stream;
  try {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'exclude'
      });
    } catch (firstErr) {
      // Older browsers may reject the Chrome-only constraint bag — retry minimal.
      if (firstErr?.name === 'NotAllowedError' || firstErr?.name === 'AbortError') throw firstErr;
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }
  } catch (err) {
    // User dismissed the picker — not an error to surface as a failure toast.
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      const cancelled = new Error('cancelled');
      cancelled.code = 'CAPTURE_CANCELLED';
      throw cancelled;
    }
    throw err;
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();
    await waitForVideoFrame(video);
    // Give the compositor a beat so the first frame is not blank.
    await new Promise((r) => setTimeout(r, 120));

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('Screen capture produced an empty frame');

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas for screen capture');
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png');
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = String(opts.fileName || `receipt-capture-${stamp}.png`).trim() || `receipt-capture-${stamp}.png`;
    return new File([blob], fileName, { type: 'image/png', lastModified: Date.now() });
  } finally {
    video.srcObject = null;
    stopStream(stream);
  }
}
