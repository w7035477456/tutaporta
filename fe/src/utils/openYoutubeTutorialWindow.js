import { YOUTUBE_VIDEO_ID_PATTERN } from 'config/youtubeMusicUrl';

const YOUTUBE_TUTORIAL_WINDOW_NAME = 'vsinglesVideoTutorialTheater';

/**
 * Extract an 11-char YouTube video id from watch / youtu.be / shorts / embed / bare id.
 * @param {unknown} value
 * @returns {string}
 */
export function extractYoutubeVideoId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (!raw.includes('://') && YOUTUBE_VIDEO_ID_PATTERN.test(raw)) {
    return raw;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
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

  videoId = String(videoId).trim();
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : '';
}

/**
 * YouTube watch URL with wide=1 (theater preference hint).
 * @param {unknown} rawUrl
 * @returns {string}
 */
export function toYoutubeTheaterWatchUrl(rawUrl) {
  const videoId = extractYoutubeVideoId(rawUrl);
  if (videoId) {
    // wide=1 is YouTube’s theater-mode preference key (also used as a cookie).
    return `https://www.youtube.com/watch?v=${videoId}&wide=1`;
  }
  return String(rawUrl ?? '').trim();
}

/**
 * Full-window embed URL — no recommendations sidebar (theater-style layout).
 * @param {string} videoId
 * @returns {string}
 */
export function toYoutubeTheaterEmbedUrl(videoId) {
  const id = String(videoId ?? '').trim();
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(id)) return '';
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1'
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function buildTheaterPopupHtml(videoId) {
  const embedSrc = toYoutubeTheaterEmbedUrl(videoId);
  const watchHref = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&wide=1`;
  // Escape for HTML attribute context
  const safeEmbed = embedSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const safeWatch = watchHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Video Tutorial — Theater</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0f0f0f; overflow: hidden; }
    .wrap { display: flex; flex-direction: column; height: 100%; }
    .player { flex: 1 1 auto; min-height: 0; }
    iframe { border: 0; width: 100%; height: 100%; display: block; background: #000; }
    .bar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 8px 12px;
      background: #212121;
      font: 13px/1.3 system-ui, sans-serif;
    }
    .bar a { color: #fff; text-decoration: none; }
    .bar a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="player">
      <iframe
        src="${safeEmbed}"
        title="Video Tutorial"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
    <div class="bar">
      <a href="${safeWatch}" target="_blank" rel="noopener noreferrer">Open on YouTube (Theater)</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open a tutorial video in a real browser window sized for theater-style viewing.
 * YouTube does not expose a reliable public URL to force Theater Mode (cookie-only),
 * so we open a full-window embed (no right-rail recommendations) — same layout goal.
 * @param {unknown} rawUrl
 * @returns {Window | null}
 */
export function openYoutubeTutorialWindow(rawUrl) {
  const videoId = extractYoutubeVideoId(rawUrl);
  const fallbackHref = toYoutubeTheaterWatchUrl(rawUrl);
  if (!videoId && !fallbackHref) return null;

  const screenW = window.screen?.availWidth || window.innerWidth || 1280;
  const screenH = window.screen?.availHeight || window.innerHeight || 800;
  // Near-fullscreen — matches YouTube theater player width
  const width = Math.max(1024, Math.min(Math.floor(screenW * 0.96), 1920));
  const height = Math.max(720, Math.min(Math.floor(screenH * 0.94), 1200));
  const left = Math.max(0, Math.floor(((window.screen?.availLeft || 0) + screenW - width) / 2));
  const top = Math.max(0, Math.floor(((window.screen?.availTop || 0) + screenH - height) / 2));

  // Do not put noopener in features — Chromium often demotes that to a tab (default YouTube layout).
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes'
  ].join(',');

  const win = window.open('about:blank', YOUTUBE_TUTORIAL_WINDOW_NAME, features);
  if (!win) {
    // Popup blocked — last resort: new tab with watch URL + wide=1
    window.open(fallbackHref || rawUrl, '_blank', 'noopener,noreferrer');
    return null;
  }

  try {
    win.opener = null;
  } catch {
    // ignore
  }

  try {
    if (videoId) {
      win.document.open();
      win.document.write(buildTheaterPopupHtml(videoId));
      win.document.close();
    } else {
      win.location.replace(fallbackHref);
    }
  } catch {
    try {
      win.location.replace(fallbackHref || String(rawUrl ?? ''));
    } catch {
      // ignore
    }
  }

  try {
    win.focus();
  } catch {
    // ignore
  }
  return win;
}
