/** YouTube video IDs are 11 characters (A–Z, a–z, 0–9, _, -). */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;

/** Popup URL fields — full watch/embed links exceed the default CT7 40-char input cap. */
export const YOUTUBE_MUSIC_URL_INPUT_MAX_CHARS = 512;
