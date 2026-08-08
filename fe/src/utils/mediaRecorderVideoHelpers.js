export function applyMicEnabledToStream(stream, enabled) {
  if (!stream) return;
  for (const track of stream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

export function pickVideoMimeType({ includeAudio = false } = {}) {
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

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '').trim();
      const marker = ';base64,';
      const base64Index = raw.indexOf(marker);
      if (!raw.startsWith('data:') || base64Index === -1) {
        resolve(raw);
        return;
      }
      const meta = raw.slice(5, base64Index).trim();
      const base64 = raw.slice(base64Index + marker.length).trim();
      const contentType = meta.split(';')[0].trim().toLowerCase() || 'video/webm';
      resolve(`data:${contentType};base64,${base64}`);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read video'));
    reader.readAsDataURL(blob);
  });
}
