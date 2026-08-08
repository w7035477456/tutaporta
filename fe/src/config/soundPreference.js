import vsinglesLyric1 from 'assets/sound/vsinglesLyric1.mp3';
import jazzBackground from 'assets/sound/jazzBackground.mp3';
import musicTranceBackground from 'assets/sound/musicTranceBackground.mp3';
import pianoBackground from 'assets/sound/pianoBackground.mp3';
import rainBackground from 'assets/sound/rainBackground.mp4';
import harpBirdsBackground from 'assets/sound/harpBirdsBackground.mp3';
import spaSaunaBackground from 'assets/sound/spaSaunaBackground.mp3';
import stormBackground from 'assets/sound/stormBackground.mp3';
import wavesSeagullsBackground from 'assets/sound/wavesSeagullsBackground.mp3';
import violinBackground from 'assets/sound/violinBackground.mp3';

/** DB `sound_preference_enum` — site-wide beds (not /vsingles lyric). */
export const SOUND_PREFERENCES = ['piano', 'harpbirds', 'spasauna', 'musictrance', 'storm', 'wavesseagulls', 'rain', 'violin', 'jazz', 'mute'];

export const SOUND_PREFERENCE_LABELS = {
  mute: 'Silent Background',
  piano: 'Piano Background',
  violin: 'Violin Background',
  jazz: 'Jazz Background',
  musictrance: 'Music Trance',
  harpbirds: 'Harp/Birds Background',
  spasauna: 'Spa/Sauna Background',
  wavesseagulls: 'Waves/Seagulls Background',
  storm: 'Storm Background'
};

/** DB `vsingles_lyric_enum` — /vsingles splash vocal only. */
export const VSINGLES_LYRIC_VALUES = ['lyric', 'mute'];

export const VSINGLES_LYRIC_LABELS = {
  lyric: 'Vsingles Lyric',
  mute: 'Mute lyric'
};

export const BACKGROUND_TRACK_SRC = {
  piano: pianoBackground,
  violin: violinBackground,
  jazz: jazzBackground,
  musictrance: musicTranceBackground,
  storm: stormBackground,
  wavesseagulls: wavesSeagullsBackground,
  harpbirds: harpBirdsBackground,
  spasauna: spaSaunaBackground,
  rain: rainBackground
};

export const LYRIC_TRACK_SRC = vsinglesLyric1;

/** Vocal lines in vsinglesLyric1.mp3 — tune `at` if copy drifts. */
export const LYRIC_CAPTION_CUES = [
  { at: 13.0, text: 'Start your real stories, start with verified dates.' },
  { at: 24.0, text: 'Endless possibilities, zero compromise.' },
  { at: 36.0, text: 'Cultivate connection through Trusted Romance.' },
  { at: 43.0, text: 'Beyond swipes, destination at Vetted Singles... at Vetted Singles.' },
  { at: 61.0, text: 'Ditch noise and choose Trusted Romance.' },
  { at: 73.0, text: 'Start your real stories, start with verified dates.' },
  { at: 84.0, text: 'Endless possibilities, zero compromise.' },
  { at: 96.0, text: 'Cultivate connection through Trusted Romance.' },
  { at: 103.0, text: 'Where transparency meets chemistry at Vetted Singles.' },
  { at: 121.0, text: 'Trusted Connections' }
];

const LEGACY_SOUND_MAP = {
  lyric: 'piano',
  flute: 'spasauna',
  vocaltrance: 'spasauna'
};

export function normalizeSoundPreference(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (SOUND_PREFERENCES.includes(key)) return key;
  if (LEGACY_SOUND_MAP[key]) return LEGACY_SOUND_MAP[key];
  return 'piano';
}

export function normalizeVsinglesLyric(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  return VSINGLES_LYRIC_VALUES.includes(key) ? key : 'lyric';
}

/** DB `volume` smallint 0–100 → 0–1 gain. */
export function volumeFromDb(stored) {
  const n = Number(stored);
  if (!Number.isFinite(n)) return 0.5;
  if (n <= 0) return 0;
  if (n <= 100) return n / 100;
  return 1;
}

export function volumeToDb(gain01) {
  const g = Math.min(1, Math.max(0, Number(gain01)));
  return Math.round(g * 100);
}
