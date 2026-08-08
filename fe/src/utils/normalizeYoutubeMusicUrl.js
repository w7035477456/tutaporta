import { YOUTUBE_VIDEO_ID_PATTERN } from 'config/youtubeMusicUrl';

/**
 * Accept watch / youtu.be / shorts / embed links or bare 11-char video ID.
 * Keep in sync with be/utils/normalizeYoutubeMusicUrl.js
 */
export function normalizeYoutubeMusicUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (!raw.includes('://') && YOUTUBE_VIDEO_ID_PATTERN.test(raw)) {
    return `https://www.youtube.com/embed/${raw}?autoplay=1&rel=0`;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  let videoId = '';
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (/^\/watch\/?$/.test(url.pathname)) {
      videoId = url.searchParams.get('v') ?? '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/').filter(Boolean)[1] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/').filter(Boolean)[1] ?? '';
    }
  }
  videoId = videoId.trim();
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return null;
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}
