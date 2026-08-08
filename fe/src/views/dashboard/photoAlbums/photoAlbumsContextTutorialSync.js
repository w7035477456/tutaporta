/**
 * Context-tutorial copy + sync for album modes.
 * Pop-out window listens on BroadcastChannel / localStorage.
 * Open via `openPhotoAlbumsContextTutorialPopout()` (Open Tutorial → floating window).
 */

export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_CHANNEL = 'pa-context-tutorial';
export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_STORAGE_KEY = 'pa-context-tutorial-mode';

/** @typedef {'idle' | 'view' | 'edit' | 'editPanZoom'} PhotoAlbumsContextTutorialMode */

export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_COPY = {
  idle: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Create Mode',
      '• 1) Add Photos: Click Open Folder to select the photos you want to include. "Use "Add All to Thumbnail Tray" or "Add selected to Thumbnail Tray".',
      '• 2A) Auto: Click "Auto Layout" above the thumbnail tray. AI will choose the best template (portrait vs landscape) and number of photos per page.',
      '• 2B) Manual: Click "Template" to create your first page layout, then drag photos into the different photo slots on the template.',
      '• 2C) Hybrid: Use "Auto Layout 1" to auto-layout one page at a time so you can manually edit before proceeding.',
      '• 3) Once one or more photos exist on the album, proceed to Album Edit Mode by double-clicking any photo.'
    ].join('\n')
  },
  view: {
    title: 'Current Context Tutorial:',
    body: [
      'You are currently in Album View Mode.',
      '• Choose a Layout: Click the Template button to select a layout for your new album page.',
      '• Add Photos: If your chosen template has an empty slot, simply drag and drop a photo from the Thumbnail Tray into the space.',
      '• Edit Photos: Double-click any photo and select "Edit Video" on popup to enter Album Edit Mode.To exit, click anywhere on the album page outside of the selected photo.',
      '• Rearrange or Remove: Drag a photo back to the Thumbnail Tray to remove it, or drag it to another slot on the page to swap locations.',
      '• Additional Features: While in View Mode, you can also:',
      '  • Play a Photo or Album Slideshow.',
      '  • Mark the current album for print ordering.',
      '  • Change the page orientation (Portrait/Landscape).',
      '  • Auto-resize images.',
      '  • Reset (blank out) the entire album page.'
    ].join('\n')
  },
  edit: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Edit Mode (Pan & Zoom is OFF).',
      '• Rearrange: Drag and drop photos back to the thumbnail tray or onto another slot to swap them.',
      '• Actions: Click any green button to make edits.',
      '• Switch Modes: Click the Pan & Zoom button to activate it.',
      '• Exit: Click anywhere on the album outside the active photo.'
    ].join('\n')
  },
  editPanZoom: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Edit Mode (Pan & Zoom is ON).',
      '• Pan: Drag the photo to reposition it.',
      '• Resize: Drag the yellow slider at the bottom of the photo.',
      '• Switch Modes: Click the Pan & Zoom button again to turn it off.',
      '• Exit: Click anywhere on the album outside the active photo.'
    ].join('\n')
  }
};

const MODE_TITLES = {
  idle: 'Album Create Mode — Context Tutorial',
  view: 'View Mode — Context Tutorial',
  edit: 'Album Edit Mode — Context Tutorial',
  editPanZoom: 'Album Edit Mode Pan&Zoom — Context Tutorial'
};

export function normalizePhotoAlbumsContextTutorialMode(mode) {
  if (mode === 'idle' || mode === 'view' || mode === 'edit' || mode === 'editPanZoom') return mode;
  return 'idle';
}

/** Green highlight while TTS speaks the active body phrase. */
export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG = '#60C446';

/** Split tutorial body into phrases for karaoke-style highlight (lines or sentences). */
export function splitPhotoAlbumsContextTutorialPhrases(body) {
  const text = String(body || '').trim();
  if (!text) return [];
  if (text.includes('\n')) {
    return text
      .split(/\n+/)
      .map((p) => p.trimEnd())
      .filter((p) => String(p).trim().length > 0);
  }
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return (parts || [text]).map((p) => p.trim()).filter(Boolean);
}

/**
 * Cue list for body phrases. Title is spoken first in the baked audio — reserve
 * proportional time before the first body highlight.
 */
export function buildPhotoAlbumsContextTutorialPhraseCues(title, phrases, durationSec) {
  const list = Array.isArray(phrases) ? phrases.filter(Boolean) : [];
  if (!list.length) return [];
  const dur = Math.max(0.5, Number(durationSec) || 12);
  const titleWeight = Math.max(1, String(title || '').length);
  const weights = list.map((p) => Math.max(1, String(p).length));
  const total = titleWeight + weights.reduce((sum, n) => sum + n, 0) || 1;
  let t = (titleWeight / total) * dur;
  return list.map((text, index) => {
    const at = t;
    t += (weights[index] / total) * dur;
    return { at, text, index };
  });
}

export function photoAlbumsContextTutorialPhraseIndexForTime(seconds, cues) {
  if (!Array.isArray(cues) || !cues.length) return -1;
  const t = Number(seconds);
  if (!Number.isFinite(t) || t < 0) return -1;
  let idx = -1;
  for (let i = 0; i < cues.length; i += 1) {
    if (t + 0.05 >= (Number(cues[i].at) || 0)) idx = i;
    else break;
  }
  return idx;
}

/** @type {HTMLAudioElement | null} */
let activeReadoutAudio = null;

/** Stop any in-progress context-tutorial readout (baked audio or speechSynthesis). */
export function cancelPhotoAlbumsContextTutorialSpeech() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore
  }
  const audio = activeReadoutAudio;
  activeReadoutAudio = null;
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

/** True while baked m4a is playing (not paused). */
export function isPhotoAlbumsContextTutorialPlaying() {
  const audio = activeReadoutAudio;
  return !!(audio && !audio.paused && !audio.ended);
}

/** True when baked m4a is paused mid-clip. */
export function isPhotoAlbumsContextTutorialPaused() {
  const audio = activeReadoutAudio;
  return !!(audio && audio.paused && audio.currentTime > 0 && !audio.ended);
}

/** Pause baked m4a without clearing highlight / position. */
export function pausePhotoAlbumsContextTutorialSpeech() {
  const audio = activeReadoutAudio;
  if (!audio || audio.paused) return false;
  try {
    audio.pause();
    return true;
  } catch {
    return false;
  }
}

/** Resume a paused baked m4a. */
export function resumePhotoAlbumsContextTutorialSpeech() {
  const audio = activeReadoutAudio;
  if (!audio || !audio.paused || audio.ended) return Promise.resolve(false);
  return audio.play().then(() => true).catch(() => false);
}

/**
 * Seek baked m4a by delta seconds (clamped). Returns false if nothing loaded.
 * @param {number} deltaSec
 */
export function seekPhotoAlbumsContextTutorialSpeech(deltaSec) {
  const audio = activeReadoutAudio;
  if (!audio) return false;
  const delta = Number(deltaSec);
  if (!Number.isFinite(delta) || delta === 0) return false;
  try {
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    let next = audio.currentTime + delta;
    if (next < 0) next = 0;
    if (dur != null && next > dur) next = dur;
    audio.currentTime = next;
    return true;
  } catch {
    return false;
  }
}

const PREFERRED_FEMALE_VOICE_RE =
  /superstar|sandy|samantha|shelley|karen|moira|tessa|fiona|victoria|aria|jenny|zira|susan|allison|ava|zoe|female|google us english/i;

function pickPreferredFemaleVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  const en = list.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
  const pool = en.length ? en : list;
  for (const re of [
    /superstar/i,
    /sandy/i,
    /samantha/i,
    /shelley/i,
    PREFERRED_FEMALE_VOICE_RE
  ]) {
    const hit = pool.find((v) => re.test(String(v.name || '')));
    if (hit) return hit;
  }
  return pool.find((v) => v.localService) || pool[0] || null;
}

async function playBakedContextTutorialAudio({
  audioUrl,
  title = '',
  phrases = [],
  onPhraseIndex,
  generation
}) {
  if (typeof Audio === 'undefined' || !audioUrl) return false;
  const gen = generation ? generation.current : 0;
  const stillCurrent = () => !generation || generation.current === gen;

  cancelPhotoAlbumsContextTutorialSpeech();
  if (!stillCurrent()) return true;

  const audio = new Audio(audioUrl);
  activeReadoutAudio = audio;

  const waitReady = () =>
    new Promise((resolve) => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        resolve();
        return;
      }
      const done = () => resolve();
      audio.addEventListener('loadedmetadata', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      window.setTimeout(done, 2000);
    });

  await waitReady();
  if (!stillCurrent()) return true;

  const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 12;
  const cues = buildPhotoAlbumsContextTutorialPhraseCues(title, phrases, dur);

  const syncHighlight = () => {
    if (!stillCurrent() || activeReadoutAudio !== audio) return;
    const next = photoAlbumsContextTutorialPhraseIndexForTime(audio.currentTime, cues);
    if (typeof onPhraseIndex === 'function') onPhraseIndex(next);
  };

  audio.addEventListener('timeupdate', syncHighlight);
  audio.addEventListener('ended', () => {
    if (activeReadoutAudio === audio) activeReadoutAudio = null;
    if (stillCurrent() && typeof onPhraseIndex === 'function') onPhraseIndex(-1);
  });

  try {
    await audio.play();
  } catch {
    if (activeReadoutAudio === audio) activeReadoutAudio = null;
    return false;
  }

  await new Promise((resolve) => {
    const finish = () => resolve();
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
    const poll = window.setInterval(() => {
      if (!stillCurrent() || activeReadoutAudio !== audio) {
        window.clearInterval(poll);
        try {
          audio.pause();
        } catch {
          // ignore
        }
        resolve();
      }
    }, 200);
    audio.addEventListener(
      'ended',
      () => {
        window.clearInterval(poll);
      },
      { once: true }
    );
  });

  if (stillCurrent() && typeof onPhraseIndex === 'function') onPhraseIndex(-1);
  return true;
}

/**
 * Prefer baked AI / neural female audio (`audioUrl`); else speechSynthesis with a
 * preferred female voice (Superstar / Sandy / Samantha when available).
 * @param {{ title?: string, phrases?: string[], audioUrl?: string, onPhraseIndex?: (i: number) => void, lang?: string, generation?: { current: number } }} opts
 */
export async function speakPhotoAlbumsContextTutorial({
  title = '',
  phrases = [],
  audioUrl = '',
  onPhraseIndex,
  lang = 'en-US',
  generation
} = {}) {
  if (audioUrl) {
    const ok = await playBakedContextTutorialAudio({
      audioUrl,
      title,
      phrases,
      onPhraseIndex,
      generation
    });
    if (ok) return;
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const gen = generation ? generation.current : 0;
  const stillCurrent = () => !generation || generation.current === gen;

  if (!synth.getVoices()?.length) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      try {
        synth.addEventListener('voiceschanged', finish, { once: true });
      } catch {
        // ignore
      }
      window.setTimeout(finish, 300);
    });
  }

  const voice = pickPreferredFemaleVoice(synth.getVoices());
  const retain = { utterance: null };

  const speakOne = (text) =>
    new Promise((resolve) => {
      if (!stillCurrent() || !String(text || '').trim()) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(String(text).trim());
      u.lang = lang;
      u.rate = 0.95;
      u.pitch = 1.05;
      if (voice) u.voice = voice;
      retain.utterance = u;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      try {
        synth.speak(u);
      } catch {
        resolve();
      }
    });

  try {
    if (title) await speakOne(title);
    const list = Array.isArray(phrases) ? phrases.filter(Boolean) : [];
    for (let i = 0; i < list.length; i += 1) {
      if (!stillCurrent()) return;
      if (typeof onPhraseIndex === 'function') onPhraseIndex(i);
      await speakOne(list[i]);
    }
  } finally {
    retain.utterance = null;
    if (stillCurrent() && typeof onPhraseIndex === 'function') onPhraseIndex(-1);
  }
}

/**
 * @param {{ photoEditActive?: boolean, panZoomActive?: boolean, hasPageContext?: boolean, hasAlbumPhotos?: boolean }} opts
 * Create Mode (idle) until the album has ≥1 photo on a page; then View Mode.
 * Edit / Pan still win when a photo is selected.
 */
export function photoAlbumsContextTutorialMode({
  photoEditActive = false,
  panZoomActive = false,
  hasAlbumPhotos = false
} = {}) {
  if (photoEditActive) return panZoomActive ? 'editPanZoom' : 'edit';
  if (hasAlbumPhotos) return 'view';
  return 'idle';
}

let latestMode = 'idle';
let openPopoutHandler = null;

export function getPhotoAlbumsContextTutorialMode() {
  return latestMode;
}

export function registerPhotoAlbumsContextTutorialPopoutOpener(fn) {
  openPopoutHandler = typeof fn === 'function' ? fn : null;
}

export function publishPhotoAlbumsContextTutorialMode(mode) {
  const next = normalizePhotoAlbumsContextTutorialMode(mode);
  latestMode = next;
  try {
    localStorage.setItem(PHOTO_ALBUMS_CONTEXT_TUTORIAL_STORAGE_KEY, next);
  } catch {
    // ignore quota / private mode
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(PHOTO_ALBUMS_CONTEXT_TUTORIAL_CHANNEL);
      ch.postMessage({ type: 'mode', mode: next });
      ch.close();
    }
  } catch {
    // ignore
  }
}

/**
 * Open (or focus) the floating context-tutorial window to the right of the album tab.
 * Registered by PhotoAlbumsContextTutorial while an album editor is active.
 */
export function openPhotoAlbumsContextTutorialPopout() {
  if (typeof openPopoutHandler === 'function') {
    openPopoutHandler();
    return true;
  }
  return false;
}

/** Normalize Vite static import (string or `{ default: string }`). */
function normalizeContextTutorialAssetImport(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof value.default === 'string') {
    return value.default.trim();
  }
  return '';
}

/** Resolve bundled asset path to an absolute URL for about:blank pop-out windows. */
export function resolvePhotoAlbumsContextTutorialAssetUrl(url, origin = '') {
  const s = normalizeContextTutorialAssetImport(url);
  if (!s) return '';
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  const base = String(origin || '').trim();
  if (!base) return s;
  try {
    return new URL(s, base).href;
  } catch {
    return s;
  }
}

function resolvePhotoAlbumsContextTutorialAssetMap(map, origin = '') {
  const out = {};
  for (const [key, value] of Object.entries(map || {})) {
    const abs = resolvePhotoAlbumsContextTutorialAssetUrl(value, origin);
    if (abs) out[key] = abs;
  }
  return out;
}

function resolvePhotoAlbumsContextTutorialAudioMap(map, origin = '') {
  const out = {};
  for (const [voice, modes] of Object.entries(map || {})) {
    const row = {};
    for (const [mode, url] of Object.entries(modes || {})) {
      const abs = resolvePhotoAlbumsContextTutorialAssetUrl(url, origin);
      if (abs) row[mode] = abs;
    }
    if (Object.keys(row).length) out[voice] = row;
  }
  return out;
}

/**
 * HTML document for a detachable popup that can sit outside the main browser tab.
 * Font stack always comes from env MAIN_FONT (`assets.mainFontFamily`); optional
 * `googleFontsHref` loads that webfont in the blank pop-out window.
 * @param {string} [initialMode]
 * @param {{ readoutImgUrl?: string, readoutImgByVoice?: Record<string, string>, readoutAudioByVoiceMode?: Record<string, Record<string, string>>, readoutAudioByMode?: Record<string, string>, initialAiVoice?: string, mainFontFamily?: string, googleFontsHref?: string, assetOrigin?: string }} [assets]
 */
export function buildPhotoAlbumsContextTutorialPopoutHtml(initialMode = 'idle', assets = {}) {
  const mode = normalizePhotoAlbumsContextTutorialMode(initialMode);
  const copy = PHOTO_ALBUMS_CONTEXT_TUTORIAL_COPY;
  const escape = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const fontKey = 'pa-context-tutorial-font-px';
  const fontFamily = String(assets.mainFontFamily || '"Comic Neue", "Comic Sans MS", cursive').replace(/"/g, "'");
  const googleFontsHref = String(assets.googleFontsHref || '').trim();
  const fontLink = googleFontsHref
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${escape(googleFontsHref)}" rel="stylesheet"/>`
    : '';
  const assetOrigin = String(assets.assetOrigin || '').trim();
  const imgByVoice = resolvePhotoAlbumsContextTutorialAssetMap(
    assets.readoutImgByVoice && typeof assets.readoutImgByVoice === 'object' ? assets.readoutImgByVoice : {},
    assetOrigin
  );
  const fallbackImgUrl = resolvePhotoAlbumsContextTutorialAssetUrl(assets.readoutImgUrl, assetOrigin);
  const audioByVoiceMode = resolvePhotoAlbumsContextTutorialAudioMap(
    assets.readoutAudioByVoiceMode && typeof assets.readoutAudioByVoiceMode === 'object'
      ? assets.readoutAudioByVoiceMode
      : {},
    assetOrigin
  );
  const legacyAudioByMode = resolvePhotoAlbumsContextTutorialAssetMap(
    assets.readoutAudioByMode && typeof assets.readoutAudioByMode === 'object' ? assets.readoutAudioByMode : {},
    assetOrigin
  );
  const initialVoice = String(assets.initialAiVoice || 'Sora').trim() || 'Sora';
  const initialImg =
    String(imgByVoice[initialVoice] || imgByVoice.Sora || fallbackImgUrl || '').trim();
  const initialLabel = `Click for audio by ${initialVoice}`;
  const imgBlock = initialImg
    ? `<div class="readout-wrap">
  <div class="readout-row">
    <div class="persona-clip">
      <img id="personaImg" class="persona" src="${escape(initialImg)}" alt="${escape(initialVoice)}" width="96" height="96"/>
    </div>
    <div class="transport" role="group" aria-label="Tutorial audio controls">
      <button type="button" id="rewBtn" class="rew" title="Rewind 5 seconds" aria-label="Rewind 5 seconds">&#9194;</button>
      <button type="button" id="playBtn" class="play" title="Play" aria-label="Play">&#9654;</button>
      <button type="button" id="ffBtn" class="ff" title="Fast forward 5 seconds" aria-label="Fast forward 5 seconds">&#9193;</button>
      <button type="button" id="pauseBtn" class="pause" title="Pause" aria-label="Pause">&#9208;</button>
      <button type="button" id="stopBtn" class="stop" title="Stop" aria-label="Stop">&#9632;</button>
    </div>
  </div>
  <button type="button" class="readout" id="readoutBtn" title="${escape(initialLabel)}" aria-label="${escape(initialLabel)}">
    <span id="readoutLabel">${escape(initialLabel)}</span>
  </button>
</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Album Context Tutorial</title>
${fontLink}
<style>
  :root{--tut-font:15px}
  html,body{margin:0;height:100%;background:#ff9800;color:#111;font-family:${fontFamily} !important}
  .wrap{box-sizing:border-box;min-height:100%;padding:10px 14px 16px;background:#ff9800;font-family:inherit}
  .bar{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0 0 10px}
  .bar button{
    width:36px;height:32px;border:2px solid #111;border-radius:6px;background:#fff;
    color:#111;font-size:22px;font-weight:900;line-height:1;cursor:pointer;padding:0;font-family:inherit
  }
  .bar button:hover{filter:brightness(0.95)}
  .bar button:active{filter:brightness(0.88)}
  .readout-wrap{
    display:flex;flex-direction:column;align-items:flex-start;max-width:100%;
    margin:0 0 12px;gap:6px
  }
  .readout-row{display:flex;flex-direction:row;align-items:center;gap:8px;max-width:100%}
  .persona-clip{
    width:96px;height:96px;flex-shrink:0;border-radius:50%;overflow:hidden;
    border:2px solid #111;box-sizing:border-box;background:#222
  }
  .persona{
    display:block;width:100%;height:100%;object-fit:cover;
    object-position:center 62%;transform:scale(0.88);transform-origin:center center
  }
  .transport{
    display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:36px 36px;
    gap:4px;justify-items:center;align-items:center
  }
  .transport button{
    width:36px;height:36px;border:2px solid #111;border-radius:50%;background:#fff;
    color:#111;font-size:14px;font-weight:900;line-height:1;cursor:pointer;padding:0;
    display:inline-flex;align-items:center;justify-content:center;font-family:inherit
  }
  .transport .rew{grid-column:1;grid-row:1}
  .transport .play{grid-column:2;grid-row:1;background:${PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG}}
  .transport .ff{grid-column:3;grid-row:1}
  .transport .pause{grid-column:1;grid-row:2}
  .transport .stop{grid-column:3;grid-row:2;background:#d32f2f;color:#fff}
  .transport button:hover{filter:brightness(0.95)}
  .readout{
    display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin:0;
    border:0;background:transparent;cursor:pointer;padding:0;font-family:inherit;color:#111
  }
  .readout span{font-size:calc(var(--tut-font) * 0.8);font-weight:800;font-family:inherit}
  h1{margin:0 0 10px;font-size:calc(var(--tut-font) * 1.1);font-weight:800;line-height:1.25;font-family:inherit}
  p{margin:0;font-size:var(--tut-font);font-weight:700;line-height:1.45;font-family:inherit}
  #body{white-space:pre-wrap}
  #body .phrase{border-radius:3px;padding:0 2px;box-decoration-break:clone;-webkit-box-decoration-break:clone;font-family:inherit}
  #body.multiline .phrase{display:block}
  #body .phrase.is-active{background:${PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG};color:#111}
  .hint{margin-top:12px;font-size:calc(var(--tut-font) * 0.85);font-weight:600;opacity:0.85;font-family:inherit}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar" role="toolbar" aria-label="Font size">
    <button type="button" id="zoomOut" title="Zoom out font size" aria-label="Zoom out font size">−</button>
    <button type="button" id="zoomIn" title="Zoom in font size" aria-label="Zoom in font size">+</button>
  </div>
  ${imgBlock}
  <h1 id="title">${escape(copy[mode].title)}</h1>
  <p id="body"></p>
  <p class="hint">Stays in sync with the album tab. Drag this window onto another monitor if you like.</p>
</div>
<script>
(function () {
  var COPY = ${JSON.stringify(copy)};
  var TITLES = ${JSON.stringify(MODE_TITLES)};
  var AUDIO_BY_VOICE = ${JSON.stringify(audioByVoiceMode)};
  var IMG_BY_VOICE = ${JSON.stringify(imgByVoice)};
  var FALLBACK_IMG = ${JSON.stringify(fallbackImgUrl)};
  var LEGACY_AUDIO_BY_MODE = ${JSON.stringify(legacyAudioByMode)};
  var CHANNEL = ${JSON.stringify(PHOTO_ALBUMS_CONTEXT_TUTORIAL_CHANNEL)};
  var STORAGE = ${JSON.stringify(PHOTO_ALBUMS_CONTEXT_TUTORIAL_STORAGE_KEY)};
  var VOICE_KEY = 'vsingles:ai-voice';
  var VOICES = ['Sora', 'Jessica', 'Michael'];
  var LEGACY_VOICE = { Sulafat: 'Sora', Achernar: 'Jessica', Enceladus: 'Michael' };
  var FONT_KEY = ${JSON.stringify(fontKey)};
  var MIN = 12;
  var MAX = 36;
  var STEP = 2;
  var SEEK_SEC = 5;
  var root = document.documentElement;
  var activePhrase = -1;
  var speaking = false;
  var speakGen = 0;
  var audio = null;
  var cues = [];
  var currentMode = 'idle';
  var currentVoice = ${JSON.stringify(initialVoice)};
  var currentTitle = '';
  var currentPhrases = [];
  function normalize(mode) {
    if (mode === 'idle' || mode === 'view' || mode === 'edit' || mode === 'editPanZoom') return mode;
    return 'idle';
  }
  function normalizeVoice(v) {
    var name = String(v || '').trim();
    if (VOICES.indexOf(name) >= 0) return name;
    if (LEGACY_VOICE[name]) return LEGACY_VOICE[name];
    return 'Sora';
  }
  function audioUrlFor(mode, voice) {
    var byVoice = AUDIO_BY_VOICE[normalizeVoice(voice)] || AUDIO_BY_VOICE.Sora || {};
    return byVoice[mode] || byVoice.idle || LEGACY_AUDIO_BY_MODE[mode] || LEGACY_AUDIO_BY_MODE.idle || '';
  }
  function imgUrlFor(voice) {
    var v = normalizeVoice(voice);
    return IMG_BY_VOICE[v] || IMG_BY_VOICE.Sora || FALLBACK_IMG || '';
  }
  function setVoiceLabel(voice) {
    currentVoice = normalizeVoice(voice);
    var label = 'Click for audio by ' + currentVoice;
    var btn = document.getElementById('readoutBtn');
    var span = document.getElementById('readoutLabel');
    var img = document.getElementById('personaImg');
    if (btn) {
      btn.setAttribute('title', label);
      btn.setAttribute('aria-label', label);
    }
    if (span) span.textContent = label;
    if (img) {
      var src = imgUrlFor(currentVoice);
      img.onerror = function () {
        var fb = imgUrlFor('Sora');
        if (fb && img.getAttribute('src') !== fb) img.setAttribute('src', fb);
      };
      if (src) img.setAttribute('src', src);
      img.setAttribute('alt', currentVoice);
    }
  }
  function splitPhrases(body) {
    var text = String(body || '').trim();
    if (!text) return [];
    if (text.indexOf('\\n') >= 0) {
      return text.split(/\\n+/).map(function (p) { return p.replace(/^\\s+|\\s+$/g, ''); }).filter(function (p) { return p.length > 0; });
    }
    var parts = text.match(/[^.!?]+[.!?]+(?:\\s+|$)|[^.!?]+$/g);
    return (parts || [text]).map(function (p) { return p.trim(); }).filter(Boolean);
  }
  function buildCues(title, phrases, durationSec) {
    var list = phrases || [];
    if (!list.length) return [];
    var dur = Math.max(0.5, Number(durationSec) || 12);
    var titleWeight = Math.max(1, String(title || '').length);
    var weights = list.map(function (p) { return Math.max(1, String(p).length); });
    var total = titleWeight + weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var t = (titleWeight / total) * dur;
    return list.map(function (text, index) {
      var at = t;
      t += (weights[index] / total) * dur;
      return { at: at, text: text, index: index };
    });
  }
  function phraseIndexForTime(seconds) {
    if (!cues.length) return -1;
    var t = Number(seconds);
    if (!isFinite(t) || t < 0) return -1;
    var idx = -1;
    for (var i = 0; i < cues.length; i++) {
      if (t + 0.05 >= (Number(cues[i].at) || 0)) idx = i;
      else break;
    }
    return idx;
  }
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function renderBody(phrases, highlightIndex, multiline) {
    var b = document.getElementById('body');
    if (!b) return;
    if (multiline) b.classList.add('multiline');
    else b.classList.remove('multiline');
    b.innerHTML = phrases.map(function (text, i) {
      var cls = 'phrase' + (i === highlightIndex ? ' is-active' : '');
      var gap = (!multiline && i < phrases.length - 1) ? ' ' : '';
      return '<span class="' + cls + '" data-phrase="' + i + '">' + escapeHtml(text) + '</span>' + gap;
    }).join('');
  }
  function setHighlight(index) {
    if (index === activePhrase) return;
    activePhrase = index;
    var nodes = document.querySelectorAll('#body .phrase');
    for (var i = 0; i < nodes.length; i++) {
      if (i === index) nodes[i].classList.add('is-active');
      else nodes[i].classList.remove('is-active');
    }
  }
  function stopSpeech() {
    speakGen += 1;
    speaking = false;
    if (audio) {
      try { audio.pause(); audio.currentTime = 0; } catch (e) {}
      audio = null;
    }
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    setHighlight(-1);
  }
  function syncHighlight() {
    if (!audio) return;
    setHighlight(phraseIndexForTime(audio.currentTime));
  }
  function seekBy(delta) {
    if (!audio) return;
    var dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    var next = audio.currentTime + delta;
    if (next < 0) next = 0;
    if (dur != null && next > dur) next = dur;
    try { audio.currentTime = next; } catch (e) {}
    syncHighlight();
  }
  function speakCurrent() {
    var url = audioUrlFor(currentMode, currentVoice);
    if (!url) return;
    stopSpeech();
    var gen = ++speakGen;
    speaking = true;
    audio = new Audio(url);
    audio.addEventListener('loadedmetadata', function () {
      if (speakGen !== gen) return;
      var dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 12;
      cues = buildCues(currentTitle, currentPhrases, dur);
    });
    audio.addEventListener('timeupdate', syncHighlight);
    audio.addEventListener('ended', function () {
      if (speakGen !== gen) return;
      speaking = false;
      setHighlight(-1);
    });
    audio.addEventListener('error', function () {
      if (speakGen !== gen) return;
      speaking = false;
      setHighlight(-1);
    });
    audio.play().catch(function () {
      if (speakGen !== gen) return;
      speaking = false;
      setHighlight(-1);
    });
  }
  function playOrResume() {
    if (audio && audio.paused && audio.currentTime > 0 && !audio.ended) {
      audio.play().catch(function () {});
      speaking = true;
      return;
    }
    if (audio && !audio.paused && !audio.ended) return;
    speakCurrent();
  }
  function pauseCurrent() {
    if (!audio || audio.paused) return;
    try { audio.pause(); } catch (e) {}
    speaking = false;
  }
  function readFont() {
    try {
      var n = Number(localStorage.getItem(FONT_KEY));
      if (Number.isFinite(n) && n >= MIN && n <= MAX) return Math.round(n);
    } catch (e) {}
    return 15;
  }
  function writeFont(px) {
    root.style.setProperty('--tut-font', px + 'px');
    try { localStorage.setItem(FONT_KEY, String(px)); } catch (e) {}
  }
  function bump(delta) {
    var next = Math.min(MAX, Math.max(MIN, readFont() + delta));
    writeFont(next);
  }
  writeFont(readFont());
  var outBtn = document.getElementById('zoomOut');
  var inBtn = document.getElementById('zoomIn');
  if (outBtn) outBtn.onclick = function () { bump(-STEP); };
  if (inBtn) inBtn.onclick = function () { bump(STEP); };
  var readoutBtn = document.getElementById('readoutBtn');
  if (readoutBtn) {
    readoutBtn.onclick = function () {
      if (audio && !audio.paused && !audio.ended) {
        pauseCurrent();
        return;
      }
      playOrResume();
    };
  }
  var rewBtn = document.getElementById('rewBtn');
  var playBtn = document.getElementById('playBtn');
  var ffBtn = document.getElementById('ffBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var stopBtn = document.getElementById('stopBtn');
  if (rewBtn) rewBtn.onclick = function () { seekBy(-SEEK_SEC); };
  if (ffBtn) ffBtn.onclick = function () { seekBy(SEEK_SEC); };
  if (playBtn) playBtn.onclick = function () { playOrResume(); };
  if (pauseBtn) pauseBtn.onclick = function () { pauseCurrent(); };
  if (stopBtn) stopBtn.onclick = function () { stopSpeech(); };
  function apply(mode) {
    stopSpeech();
    var m = normalize(mode);
    currentMode = m;
    var c = COPY[m] || COPY.idle;
    var t = document.getElementById('title');
    if (t) t.textContent = c.title;
    currentTitle = c.title || '';
    currentPhrases = splitPhrases(c.body);
    renderBody(currentPhrases, -1, String(c.body || '').indexOf('\\n') >= 0);
    activePhrase = -1;
    document.title = TITLES[m] || TITLES.idle;
  }
  try {
    setVoiceLabel(localStorage.getItem(VOICE_KEY) || currentVoice);
  } catch (e) {
    setVoiceLabel(currentVoice);
  }
  apply(${JSON.stringify(mode)});
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = function (ev) {
        if (ev && ev.data && ev.data.type === 'mode') apply(ev.data.mode);
        if (ev && ev.data && ev.data.type === 'voice') {
          stopSpeech();
          setVoiceLabel(ev.data.voice);
        }
      };
    }
  } catch (e) {}
  window.addEventListener('storage', function (ev) {
    if (ev.key === STORAGE) apply(ev.newValue);
    if (ev.key === VOICE_KEY) {
      stopSpeech();
      setVoiceLabel(ev.newValue);
    }
  });
  window.addEventListener('beforeunload', stopSpeech);
})();
</script>
</body>
</html>`;
}
