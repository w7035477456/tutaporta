import api from './axios';
import { normalizeSoundPreference, normalizeVsinglesLyric } from 'config/soundPreference';
import {
  RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX,
  RECORD_VAULT_DEFAULT_FONT_SIZE_PT,
  RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX,
  RECORD_VAULT_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS,
  RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX
} from 'views/dashboard/recordVault/recordVaultNoteFontTokens';

/** Slots 1–9 = Embedded Youtube Player tracks; slot 10 = Slide Show Music. */
export const CUSTOM_MUSIC_URL_SLOT_COUNT = 10;

/** 0-based index 9 — UI slot 10 (Slide Show Music). */
export const SLIDE_SHOW_MUSIC_SLOT_INDEX = 9;

export function emptyCustomMusicUrlSlots() {
  return Array.from({ length: CUSTOM_MUSIC_URL_SLOT_COUNT }, () => null);
}

function parseChatFontSize(data) {
  const n = Number(data?.chatFontSize);
  return Number.isFinite(n) ? n : null;
}

function parseMynoteFontSize(data) {
  const n = Number(data?.mynoteFontSize);
  if (Number.isFinite(n)) return n;
  return RECORD_VAULT_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS;
}

function parseVolume(data) {
  const n = Number(data?.volume);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(n)));
}

function parseLyricMute(data) {
  if (data?.lyricMute === true || data?.lyricMute === 'true') return true;
  if (data?.lyricMute === false || data?.lyricMute === 'false') return false;
  const vsinglesLyric = String(data?.vsinglesLyric ?? '').toLowerCase();
  if (vsinglesLyric === 'mute') return true;
  if (data?.lyricVolume != null) {
    return Number(data.lyricVolume) <= 0;
  }
  return Boolean(data?.lyricMute);
}

function parseLyricVolume(data) {
  const n = Number(data?.lyricVolume);
  if (Number.isFinite(n)) return Math.min(100, Math.max(0, Math.trunc(n)));
  return 1;
}

function parseCustomMusicUrls(data) {
  const raw = data?.customMusicUrls;
  if (!Array.isArray(raw)) return emptyCustomMusicUrlSlots();
  const slots = emptyCustomMusicUrlSlots();
  for (let i = 0; i < CUSTOM_MUSIC_URL_SLOT_COUNT; i++) {
    const item = raw[i];
    const trimmed = item == null ? '' : String(item).trim();
    slots[i] = trimmed || null;
  }
  return slots;
}

function parseNullableId(data, key) {
  const n = Number(data?.[key]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseColorIndexOrDefault(data, key, fallback) {
  if (data?.[key] === null || data?.[key] === undefined) return fallback;
  const n = Number(data[key]);
  if (!Number.isFinite(n) || n < 0 || n > 6) return fallback;
  return Math.trunc(n);
}

function parseMynoteEditorPrefs(data) {
  return {
    mynoteLastNotebookId: parseNullableId(data, 'mynoteLastNotebookId'),
    mynoteLastNoteId: parseNullableId(data, 'mynoteLastNoteId'),
    mynoteContentBgIndex: parseColorIndexOrDefault(
      data,
      'mynoteContentBgIndex',
      RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX
    ),
    mynoteFontColorIndex: parseColorIndexOrDefault(
      data,
      'mynoteFontColorIndex',
      RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX
    ),
    mynoteTextHighlightIndex: parseColorIndexOrDefault(
      data,
      'mynoteTextHighlightIndex',
      RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX
    ),
    mynoteEditorFontSizePt: (() => {
      const n = Number(data?.mynoteEditorFontSizePt);
      return Number.isFinite(n) && n >= 4 && n <= 128
        ? Math.trunc(n)
        : RECORD_VAULT_DEFAULT_FONT_SIZE_PT;
    })(),
    mynoteNoteScrollTop: (() => {
      const n = Number(data?.mynoteNoteScrollTop);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
    })(),
    mynoteEditorCaretPos: (() => {
      const n = Number(data?.mynoteEditorCaretPos);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
    })()
  };
}

const MYNOTE_EDITOR_PREF_KEYS = [
  'mynoteLastNotebookId',
  'mynoteLastNoteId',
  'mynoteContentBgIndex',
  'mynoteFontColorIndex',
  'mynoteTextHighlightIndex',
  'mynoteEditorFontSizePt',
  'mynoteNoteScrollTop',
  'mynoteEditorCaretPos'
];

function mapCustomizationResponse(data) {
  return {
    chatFontSize: parseChatFontSize(data),
    mynoteFontSize: parseMynoteFontSize(data),
    soundPreference: normalizeSoundPreference(data?.soundPreference),
    vsinglesLyric: normalizeVsinglesLyric(data?.vsinglesLyric),
    lyricMute: parseLyricMute(data),
    lyricVolume: parseLyricVolume(data),
    volume: parseVolume(data),
    customMusicUrls: parseCustomMusicUrls(data),
    ...parseMynoteEditorPrefs(data)
  };
}

export async function fetchUserCustomization() {
  const { data } = await api.get('/api/user/customization');
  return mapCustomizationResponse(data);
}

export async function saveUserCustomization(patch) {
  const body = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'chatFontSize')) {
    body.chatFontSize = patch.chatFontSize;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'mynoteFontSize')) {
    body.mynoteFontSize = patch.mynoteFontSize;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'soundPreference')) {
    body.soundPreference = normalizeSoundPreference(patch.soundPreference);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'vsinglesLyric')) {
    body.vsinglesLyric = normalizeVsinglesLyric(patch.vsinglesLyric);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lyricMute')) {
    body.lyricMute = Boolean(patch.lyricMute);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lyricVolume')) {
    body.lyricVolume = patch.lyricVolume;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'volume')) {
    body.volume = patch.volume;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'customMusicUrls')) {
    body.customMusicUrls = patch.customMusicUrls;
  }
  for (const key of MYNOTE_EDITOR_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      body[key] = patch[key];
    }
  }
  const { data } = await api.put('/api/user/customization', body);
  return mapCustomizationResponse(data);
}

/** Load global.default_music_url into this user's custom_music_url slots. */
export async function loadDefaultCustomMusicUrls() {
  const { data } = await api.post('/api/user/customization/load-default-music-urls');
  return mapCustomizationResponse(data);
}
