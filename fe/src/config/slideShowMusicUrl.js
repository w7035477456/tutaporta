import { normalizeYoutubeMusicUrl } from 'utils/normalizeYoutubeMusicUrl';

/** Hard-coded Slide Show / Full Slide background music (temporary). */
const SLIDE_SHOW_MUSIC_URL_RAW =
  'https://www.youtube.com/watch?v=Dvlc8vqxivl&list=PLIILL6veL7802G94eulr2fzj0wz7CwKqh&index=3';

export const SLIDE_SHOW_MUSIC_URL =
  normalizeYoutubeMusicUrl(SLIDE_SHOW_MUSIC_URL_RAW) ?? SLIDE_SHOW_MUSIC_URL_RAW;
